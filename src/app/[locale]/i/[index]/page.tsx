import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicIndex, listChildIndices, listIndexAgents } from "@/lib/federation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; index: string }> }): Promise<Metadata> {
  const { index } = await params;
  const entry = await getPublicIndex(index.toLowerCase());
  if (!entry) return { title: "Index not found", robots: { index: false, follow: false } };
  return { title: `${entry.display_name} index`, description: entry.summary || `Federated agent index ${entry.handle} on agents.index.` };
}

export default async function FederatedIndexPage({ params }: { params: Promise<{ locale: string; index: string }> }) {
  const { locale, index: rawIndex } = await params;
  const spanish = locale === "es";
  if (!spanish && locale !== "en") notFound();
  const index = await getPublicIndex(rawIndex.toLowerCase());
  if (!index) notFound();
  let agents: { handle: string; display_name: string; summary: string }[] = [];
  let children: { handle: string; display_name: string; summary: string }[] = [];
  let unavailable = false;
  try {
    [agents, children] = await Promise.all([
      listIndexAgents(index.handle) as Promise<typeof agents>,
      listChildIndices(index.handle) as Promise<typeof children>,
    ]);
  } catch { unavailable = true; }
  return <main className="shell"><header className="topbar"><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><nav><a href={`/${locale}`}>{spanish ? "Directorio" : "Directory"}</a><a className="lang" href={`/${spanish ? "en" : "es"}/i/${index.handle}`}>{spanish ? "EN" : "ES"}</a></nav></header>
    <section className="profile-page"><a className="back-link" href={`/${locale}`}>← {spanish ? "Volver al índice" : "Back to index"}</a><p className="eyebrow">{spanish ? "ÍNDICE FEDERADO" : "FEDERATED INDEX"}</p><h1>{index.display_name}</h1><p className="profile-handle">agent://{index.handle}</p><p className="profile-summary">{index.summary}</p>{index.profile_handle && <a className="primary-button" href={`/${locale}/${index.profile_handle}`}>{spanish ? "Ver tarjeta de la organización" : "View organization card"} ↗</a>}<p className="updated">{spanish ? "Índice interoperable registrado" : "Registered interoperable index"}</p></section>
    <section className="directory"><div className="section-head"><div><p className="eyebrow">{spanish ? "SUBÍNDICE" : "SUBINDEX"}</p><h2>{spanish ? "Agentes en este índice" : "Agents in this index"}</h2></div><span className="count">{String(agents.length).padStart(2, "0")}</span></div>
      {unavailable ? <p className="empty">{spanish ? "El índice no está disponible ahora. Inténtalo de nuevo más tarde." : "This index is unavailable right now. Try again later."}</p> : agents.length ? <div className="cards">{agents.map((agent) => <article className="agent-card" key={agent.handle}><div className="avatar">{agent.display_name.slice(0, 1).toUpperCase()}</div><div className="card-main"><div className="card-title"><a href={`/${locale}/i/${index.handle}/${agent.handle}`}>{agent.display_name}</a><span className="handle">@{agent.handle}</span></div><p>{agent.summary || "—"}</p><div className="card-links"><a href={`/${locale}/i/${index.handle}/${agent.handle}`}>{spanish ? "Ver tarjeta" : "View card"} ↗</a></div></div><span className="verified-mark">✳</span></article>)}</div> : <p className="empty">{spanish ? "Este índice todavía no publica perfiles." : "This index has no public profiles yet."}</p>}
    </section>{children.length > 0 && <section className="directory"><div className="section-head"><div><p className="eyebrow">{spanish ? "ÍNDICES CONECTADOS" : "CONNECTED INDICES"}</p><h2>{spanish ? "Subíndices" : "Subindices"}</h2></div><span className="count">{String(children.length).padStart(2, "0")}</span></div><div className="cards">{children.map((child) => <article className="agent-card" key={child.handle}><div className="avatar">{child.display_name.slice(0, 1).toUpperCase()}</div><div className="card-main"><div className="card-title"><a href={`/${locale}/i/${index.handle}/_index/${child.handle}`}>{child.display_name}</a><span className="handle">agent://{child.handle}</span></div><p>{child.summary || "—"}</p><div className="card-links"><a href={`/${locale}/i/${index.handle}/_index/${child.handle}`}>{spanish ? "Explorar índice" : "Browse index"} ↗</a></div></div><span className="verified-mark">✳</span></article>)}</div></section>}<footer><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><span>agent://{index.handle}</span><a href={`/api/v1/indices/${index.handle}`}>JSON ↗</a></footer></main>;
}
