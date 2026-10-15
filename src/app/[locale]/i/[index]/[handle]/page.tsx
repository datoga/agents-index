import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveAgentUri } from "@/lib/federation";

type Agent = { handle: string; display_name: string; summary: string; public_email: string | null; links: { label: string; url: string; type?: string }[]; updated_at: string };
type Index = { handle: string; display_name: string };

async function load(index: string, handle: string): Promise<{ agent: Agent; index: Index; childIndex: Index | null }> {
  const result = await resolveAgentUri(`agent://${index}/${handle}`);
  if (!result.agent || !result.index) notFound();
  return { agent: result.agent as Agent, index: result.index as Index, childIndex: result.child_index as Index | null };
}

export async function generateMetadata({ params }: { params: Promise<{ index: string; handle: string }> }): Promise<Metadata> {
  const { index, handle } = await params;
  try { const { agent } = await load(index.toLowerCase(), handle.toLowerCase()); return { title: `${agent.display_name} (@${agent.handle})`, description: agent.summary.slice(0, 200) }; }
  catch { return { title: "Profile not found", robots: { index: false, follow: false } }; }
}

export default async function FederatedAgentPage({ params }: { params: Promise<{ locale: string; index: string; handle: string }> }) {
  const { locale, index: rawIndex, handle: rawHandle } = await params;
  if (locale !== "es" && locale !== "en") notFound();
  const indexHandle = rawIndex.toLowerCase();
  let agent: Agent; let index: Index; let childIndex: Index | null;
  try { ({ agent, index, childIndex } = await load(indexHandle, rawHandle.toLowerCase())); } catch { notFound(); }
  const spanish = locale === "es";
  return <main className="shell"><header className="topbar"><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><nav><a href={`/${locale}/i/${indexHandle}`}>{index.display_name}</a><a className="lang" href={`/${spanish ? "en" : "es"}/i/${indexHandle}/${agent.handle}`}>{spanish ? "EN" : "ES"}</a></nav></header>
    <section className="profile-page"><a className="back-link" href={`/${locale}/i/${indexHandle}`}>← {spanish ? "Volver al subíndice" : "Back to subindex"}</a><div className="profile-avatar">{agent.display_name.slice(0, 1).toUpperCase()}</div><p className="eyebrow">{spanish ? "TARJETA PÚBLICA · ÍNDICE FEDERADO" : "PUBLIC CARD · FEDERATED INDEX"}</p><h1>{agent.display_name}</h1><p className="profile-handle">@{agent.handle} · {index.display_name}</p><p className="profile-summary">{agent.summary}</p>{agent.public_email && <a className="primary-button" href={`mailto:${agent.public_email}`}>{spanish ? "Contactar por email" : "Contact by email"} ↗</a>}
      {childIndex && <a className="primary-button" href={`/${locale}/i/${indexHandle}/_index/${childIndex.handle}`}>{spanish ? "Explorar también su subíndice" : "Browse its subindex"} ↗</a>}
      {agent.links?.length > 0 && <div className="profile-links">{agent.links.map((link) => <a key={link.url} href={link.url.startsWith("agent://") ? `/${locale}/resolve?uri=${encodeURIComponent(link.url)}` : link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
      <p className="updated">agent://{indexHandle}/{agent.handle}</p></section><footer><a className="wordmark" href={`/${locale}`}>agents<span>.</span>index</a><span>{index.display_name}</span><a href={`/api/v1/resolve?uri=${encodeURIComponent(`agent://${indexHandle}/${agent.handle}`)}`}>JSON ↗</a></footer></main>;
}
