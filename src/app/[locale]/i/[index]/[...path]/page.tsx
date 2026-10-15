import type { Metadata } from "next";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { getNestedIndex, listNestedIndexAgents, resolveAgentUri } from "@/lib/federation";

type Agent = { handle: string; display_name: string; summary: string; public_email: string | null; links: { label: string; url: string }[] };

async function getResolved(index: string, path: string[]) {
  const uri = `agent://${index}/${path.join("/")}`;
  return { uri, resolved: await resolveAgentUri(uri) };
}

export async function generateMetadata({ params }: { params: Promise<{ index: string; path: string[] }> }): Promise<Metadata> {
  const { index, path } = await params;
  if (path[0] === "_index" && path[1] && path.length === 2) {
    try {
      const child = await getNestedIndex(index.toLowerCase(), path[1].toLowerCase()) as { display_name: string; summary?: string };
      return { title: `${child.display_name} index`, description: child.summary };
    } catch { return { title: "Federated index not found", robots: { index: false, follow: false } }; }
  }
  try {
    const { resolved } = await getResolved(index.toLowerCase(), path.map((part) => part.toLowerCase()));
    const agent = resolved.agent as Agent | null;
    if (!agent) return { title: "Federated index", robots: { index: false, follow: false } };
    return { title: `${agent.display_name} (@${agent.handle})`, description: agent.summary.slice(0, 200) };
  } catch { return { title: "Federated profile not found", robots: { index: false, follow: false } }; }
}

export default async function DeepFederatedAgentPage({ params }: { params: Promise<{ locale: string; index: string; path: string[] }> }) {
  const { locale, index: rawIndex, path: rawPath } = await params;
  if (locale !== "es" && locale !== "en") notFound();
  const index = rawIndex.toLowerCase();
  const path = rawPath.map((part) => part.toLowerCase());
  if (path[0] === "_index" && path[1] && path.length === 2) {
    let child: { handle: string; display_name: string; summary: string };
    let agents: Agent[];
    try {
      [child, agents] = await Promise.all([
        getNestedIndex(index, path[1]) as Promise<typeof child>,
        listNestedIndexAgents(index, path[1]) as Promise<Agent[]>,
      ]);
    } catch { notFound(); }
    const spanish = locale === "es";
    return <main className="shell"><header className="topbar"><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><nav><a href={`/${locale}/i/${index}`}>agent://{index}</a><a className="lang" href={`/${spanish ? "en" : "es"}/i/${index}/_index/${child.handle}`}>{spanish ? "EN" : "ES"}</a></nav></header>
      <section className="profile-page"><a className="back-link" href={`/${locale}/i/${index}`}>← {spanish ? "Volver al índice" : "Back to index"}</a><p className="eyebrow">{spanish ? "SUBÍNDICE FEDERADO" : "FEDERATED SUBINDEX"}</p><h1>{child.display_name}</h1><p className="profile-handle">agent://{index}/{child.handle}</p><p className="profile-summary">{child.summary}</p></section>
      <section className="directory"><div className="section-head"><div><p className="eyebrow">{spanish ? "AGENTES" : "AGENTS"}</p><h2>{spanish ? "Agentes en este índice" : "Agents in this index"}</h2></div><span className="count">{String(agents.length).padStart(2, "0")}</span></div>{agents.length ? <div className="cards">{agents.map((agent) => <article className="agent-card" key={agent.handle}><div className="avatar">{agent.display_name.slice(0, 1).toUpperCase()}</div><div className="card-main"><div className="card-title"><a href={`/${locale}/i/${index}/${child.handle}/${agent.handle}`}>{agent.display_name}</a><span className="handle">@{agent.handle}</span></div><p>{agent.summary || "—"}</p></div><span className="verified-mark">✳</span></article>)}</div> : <p className="empty">{spanish ? "Este índice todavía no publica perfiles." : "This index has no public profiles yet."}</p>}</section></main>;
  }
  let result: Awaited<ReturnType<typeof getResolved>>;
  try { result = await getResolved(index, path); } catch { notFound(); }
  if (result.resolved.resolved_at) {
    const destination = new URL(`/${locale}/resolve`, result.resolved.resolved_at);
    destination.searchParams.set("uri", result.uri);
    redirect(destination.toString() as Route);
  }
  const agent = result.resolved.agent as Agent | null;
  if (!agent) notFound();
  const spanish = locale === "es";
  const displayName = agent.display_name;
  return <main className="shell"><header className="topbar"><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><nav><a href={`/${locale}/i/${index}`}>agent://{index}</a><a className="lang" href={`/${spanish ? "en" : "es"}/i/${index}/${path.join("/")}`}>{spanish ? "EN" : "ES"}</a></nav></header>
    <section className="profile-page"><a className="back-link" href={`/${locale}/i/${index}`}>← {spanish ? "Volver al índice" : "Back to index"}</a><div className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</div><p className="eyebrow">{spanish ? "TARJETA PÚBLICA · ÍNDICE FEDERADO" : "PUBLIC CARD · FEDERATED INDEX"}</p><h1>{displayName}</h1><p className="profile-handle">@{agent.handle}</p><p className="profile-summary">{agent.summary}</p>{agent.public_email && <a className="primary-button" href={`mailto:${agent.public_email}`}>{spanish ? "Contactar por email" : "Contact by email"} ↗</a>}
      {agent.links?.length > 0 && <div className="profile-links">{agent.links.map((link) => <a key={link.url} href={link.url.startsWith("agent://") ? `/${locale}/resolve?uri=${encodeURIComponent(link.url)}` : link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
      <p className="updated">{result.uri}</p></section><footer><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><span>agent://{index}</span><a href={`/api/v1/resolve?uri=${encodeURIComponent(result.uri)}`}>JSON ↗</a></footer></main>;
}
