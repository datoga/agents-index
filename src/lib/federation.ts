import { getPool } from "@/lib/db";
import { publicIndexConfig } from "@/lib/registration";

export type FederatedIndex = {
  handle: string;
  display_name: string;
  summary: string;
  avatar_url: string | null;
  endpoint_url: string;
  parent_handle: string | null;
  status: "active" | "suspended";
  profile_handle: string | null;
};

export async function getPublicIndices(): Promise<Omit<FederatedIndex, "endpoint_url" | "status" | "profile_handle">[]> {
  const result = await getPool().query(
    `SELECT i.handle, COALESCE(p.display_name, i.display_name) AS display_name,
            COALESCE(NULLIF(p.summary, ''), i.summary) AS summary, p.avatar_url, i.parent_handle
       FROM federated_indices i LEFT JOIN profiles p ON p.handle = i.profile_handle
      WHERE i.status = 'active' ORDER BY i.handle`,
  );
  return result.rows as Omit<FederatedIndex, "endpoint_url" | "status" | "profile_handle">[];
}

export async function getPublicIndex(handle: string): Promise<Omit<FederatedIndex, "endpoint_url" | "status"> | null> {
  const result = await getPool().query(
    `SELECT i.handle, COALESCE(p.display_name, i.display_name) AS display_name,
            COALESCE(p.summary, i.summary) AS summary, p.avatar_url, i.parent_handle, i.profile_handle
       FROM federated_indices i LEFT JOIN profiles p ON p.handle = i.profile_handle
      WHERE i.handle = $1 AND i.status = 'active'`,
    [handle],
  );
  return (result.rows[0] as Omit<FederatedIndex, "endpoint_url" | "status"> | undefined) ?? null;
}

export async function getProfileIndex(profileHandle: string): Promise<{ handle: string; display_name: string; summary: string } | null> {
  const result = await getPool().query(
    `SELECT i.handle, COALESCE(p.display_name, i.display_name) AS display_name,
            COALESCE(NULLIF(p.summary, ''), i.summary) AS summary
       FROM federated_indices i LEFT JOIN profiles p ON p.handle = i.profile_handle
      WHERE i.status = 'active' AND i.profile_handle = $1`,
    [profileHandle],
  );
  return (result.rows[0] as { handle: string; display_name: string; summary: string } | undefined) ?? null;
}

export async function listIndexAgents(handle: string): Promise<unknown[]> {
  const result = await getPool().query("SELECT endpoint_url FROM federated_indices WHERE handle = $1 AND status = 'active'", [handle]);
  const row = result.rows[0] as { endpoint_url: string } | undefined;
  if (!row) throw new Error("not_found");
  const endpoint = new URL(row.endpoint_url);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/v1/agents`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("upstream_unavailable");
    const payload = await response.json() as { agents?: unknown[] };
    return payload.agents ?? [];
  } catch (cause) {
    if (cause instanceof Error && cause.message === "upstream_unavailable") throw cause;
    throw new Error("upstream_unavailable");
  }
}

export async function listChildIndices(handle: string): Promise<unknown[]> {
  const result = await getPool().query("SELECT endpoint_url FROM federated_indices WHERE handle = $1 AND status = 'active'", [handle]);
  const row = result.rows[0] as { endpoint_url: string } | undefined;
  if (!row) throw new Error("not_found");
  const endpoint = new URL(row.endpoint_url);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/v1/indices`;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("upstream_unavailable");
    const payload = await response.json() as { indices?: unknown[] };
    return payload.indices ?? [];
  } catch (cause) {
    if (cause instanceof Error && cause.message === "upstream_unavailable") throw cause;
    throw new Error("upstream_unavailable");
  }
}

async function nestedIndexRequest(parentHandle: string, childHandle: string, suffix: string): Promise<Response> {
  const result = await getPool().query("SELECT endpoint_url FROM federated_indices WHERE handle = $1 AND status = 'active'", [parentHandle]);
  const row = result.rows[0] as { endpoint_url: string } | undefined;
  if (!row) throw new Error("not_found");
  const endpoint = new URL(row.endpoint_url);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/v1/indices/${encodeURIComponent(childHandle)}${suffix}`;
  try { return await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) }); }
  catch { throw new Error("upstream_unavailable"); }
}

export async function getNestedIndex(parentHandle: string, childHandle: string): Promise<unknown> {
  const response = await nestedIndexRequest(parentHandle, childHandle, "");
  if (response.status === 404) throw new Error("not_found");
  if (!response.ok) throw new Error("upstream_unavailable");
  const payload = await response.json() as { index?: unknown };
  if (!payload.index) throw new Error("not_found");
  return payload.index;
}

export async function listNestedIndexAgents(parentHandle: string, childHandle: string): Promise<unknown[]> {
  const response = await nestedIndexRequest(parentHandle, childHandle, "/agents");
  if (response.status === 404) throw new Error("not_found");
  if (!response.ok) throw new Error("upstream_unavailable");
  const payload = await response.json() as { agents?: unknown[] };
  return payload.agents ?? [];
}

export async function resolveAgentUri(uri: string, hops = 0): Promise<{ agent: unknown | null; index: unknown | null; child_index?: unknown | null; resolved_at?: string }> {
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new Error("invalid_uri"); }
  if (parsed.protocol !== "agent:" || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) throw new Error("invalid_uri");
  const indexHandle = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(indexHandle) || segments.length > 5) throw new Error("invalid_uri");
  const normalizedSegments = segments.map((segment) => segment.toLowerCase());
  if (normalizedSegments.some((segment) => !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(segment))) throw new Error("invalid_uri");

  const pool = getPool();
  const config = publicIndexConfig();
  const localIndexHandle = config.handle;
  const parent = config.parent_index_url;

  const resolveAtParent = async (): Promise<{ agent: unknown | null; index: unknown | null; child_index?: unknown | null; resolved_at: string }> => {
    if (!parent || hops >= 4) throw new Error("not_found");
    let parentUrl: URL;
    try { parentUrl = new URL(parent); } catch { throw new Error("upstream_unavailable"); }
    parentUrl.pathname = `${parentUrl.pathname.replace(/\/$/, "")}/api/v1/resolve`;
    parentUrl.searchParams.set("uri", uri);
    try {
      const response = await fetch(parentUrl, {
        headers: { Accept: "application/json", "x-agents-index-hop": String(hops + 1) },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(4000),
      });
      if (response.status === 404) throw new Error("not_found");
      if (!response.ok) throw new Error("upstream_unavailable");
      const payload = await response.json() as { agent?: unknown | null; index?: unknown | null; child_index?: unknown | null; resolved_at?: string };
      return { agent: payload.agent ?? null, index: payload.index ?? null, child_index: payload.child_index ?? null, resolved_at: payload.resolved_at ?? parent };
    } catch (cause) {
      if (cause instanceof Error && ["not_found", "upstream_unavailable"].includes(cause.message)) throw cause;
      throw new Error("upstream_unavailable");
    }
  };

  if (normalizedSegments.length === 0) {
    const [agentResult, indexResult] = await Promise.all([
      pool.query("SELECT handle, display_name, summary, public_email, avatar_url, links, metadata, updated_at FROM profiles WHERE handle = $1", [indexHandle]),
      pool.query("SELECT handle, display_name, summary, parent_handle FROM federated_indices WHERE handle = $1 AND status = 'active'", [indexHandle]),
    ]);
    const agent = agentResult.rows[0] ?? null;
    const index = indexResult.rows[0] ?? (localIndexHandle === indexHandle ? { handle: indexHandle, display_name: config.name, summary: "" } : null);
    if (!agent && !index) return resolveAtParent();
    return { agent, index };
  }

  if (localIndexHandle === indexHandle) {
    if (normalizedSegments.length === 1) {
      const targetHandle = normalizedSegments[0]!;
      const [agentResult, childIndexResult] = await Promise.all([
        pool.query("SELECT handle, display_name, summary, public_email, avatar_url, links, metadata, updated_at FROM profiles WHERE handle = $1", [targetHandle]),
        pool.query("SELECT handle, display_name, summary, parent_handle FROM federated_indices WHERE handle = $1 AND status = 'active'", [targetHandle]),
      ]);
      const agent = agentResult.rows[0] ?? null;
      const childIndex = childIndexResult.rows[0] ?? null;
      if (!agent && !childIndex) throw new Error("not_found");
      return { agent, index: { handle: indexHandle, display_name: config.name, summary: "" }, child_index: childIndex };
    }
    const childHandle = normalizedSegments[0]!;
    const childResult = await pool.query("SELECT endpoint_url FROM federated_indices WHERE handle = $1 AND status = 'active'", [childHandle]);
    const child = childResult.rows[0] as { endpoint_url: string } | undefined;
    if (!child) throw new Error("not_found");
    const childUrl = new URL(child.endpoint_url);
    childUrl.pathname = `${childUrl.pathname.replace(/\/$/, "")}/api/v1/resolve`;
    childUrl.searchParams.set("uri", `agent://${childHandle}/${normalizedSegments.slice(1).join("/")}`);
    try {
      const response = await fetch(childUrl, { headers: { Accept: "application/json", "x-agents-index-hop": String(hops + 1) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
      if (response.status === 404) throw new Error("not_found");
      if (!response.ok) throw new Error("upstream_unavailable");
      const payload = await response.json() as { agent?: unknown | null; index?: unknown | null; child_index?: unknown | null; resolved_at?: string };
      if (!payload.agent && !payload.index && !payload.child_index) throw new Error("not_found");
      return { agent: payload.agent ?? null, index: payload.index ?? null, child_index: payload.child_index ?? null, resolved_at: payload.resolved_at };
    } catch (cause) {
      if (cause instanceof Error && ["not_found", "upstream_unavailable"].includes(cause.message)) throw cause;
      throw new Error("upstream_unavailable");
    }
  }

  const indexResult = await pool.query(
    "SELECT handle, display_name, summary, endpoint_url, parent_handle FROM federated_indices WHERE handle = $1 AND status = 'active'",
    [indexHandle],
  );
  const index = indexResult.rows[0] as { handle: string; display_name: string; summary: string; endpoint_url: string; parent_handle: string | null } | undefined;
  if (!index) return resolveAtParent();

  let endpoint: URL;
  try { endpoint = new URL(index.endpoint_url); } catch { throw new Error("upstream_unavailable"); }
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/v1/resolve`;
  endpoint.searchParams.set("uri", `agent://${indexHandle}/${normalizedSegments.join("/")}`);
  endpoint.hash = "";
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json", "x-agents-index-hop": String(hops + 1) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
    if (response.status === 404) throw new Error("not_found");
    if (!response.ok) throw new Error("upstream_unavailable");
    const payload = await response.json() as { agent?: unknown | null; index?: unknown | null; child_index?: unknown | null; resolved_at?: string };
    if (!payload.agent && !payload.index && !payload.child_index) throw new Error("not_found");
    return { agent: payload.agent ?? null, index: { handle: index.handle, display_name: index.display_name, summary: index.summary, parent_handle: index.parent_handle }, child_index: payload.child_index ?? null, resolved_at: payload.resolved_at };
  } catch (cause) {
    if (cause instanceof Error && ["not_found", "upstream_unavailable"].includes(cause.message)) throw cause;
    throw new Error("upstream_unavailable");
  }
}
