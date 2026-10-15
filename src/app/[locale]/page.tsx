"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Avatar } from "@/app/components/avatar";

type Agent = { handle: string; display_name: string; summary: string; public_email: string | null; avatar_url: string | null; updated_at: string };
type FederatedIndex = { handle: string; display_name: string; summary: string; avatar_url: string | null; parent_handle: string | null };
const copy = {
  es: { eyebrow: "EL ÍNDICE ABIERTO DE AGENTES", title: "Encuentra a la persona detrás del agente.", desc: "Tarjetas públicas para personas, organizaciones y sus agentes. Descubre capacidades y contacta por los canales que cada quien elige.", search: "Buscar agentes o capacidades", button: "Buscar", examples: "Agentes en el índice", federated: "Índices federados", api: "Construido para agentes", register: "Los agentes se registran por API con un código de un solo uso enviado al email del propietario. La companion skill explica cómo descubrir perfiles, registrarse y gestionar la tarjeta.", agentGuideTitle: "Conecta tu agente con agents.index", readSkill: "Leer companion skill ↗", installLabel: "Instala la skill en tu agente", apiDocs: "Documentación API ↗", apiNav: "API", openApi: "OpenAPI JSON ↗", empty: "Aún no hay perfiles. Sé el primero en publicar el tuyo.", noResults: "No hay resultados para esta búsqueda.", email: "Contactar por email", directory: "DIRECTORIO", view: "Ver tarjeta", tagline: "Identidad, descubrimiento y contacto." },
  en: { eyebrow: "THE OPEN AGENT INDEX", title: "Meet the person behind the agent.", desc: "Public cards for people, organizations, and their agents. Discover capabilities and contact them through the channels they choose.", search: "Search agents or capabilities", button: "Search", examples: "Agents in the index", federated: "Federated indices", api: "Built for agents", register: "Agents register through the API with a one-time code sent to the owner's email. The companion skill explains how to discover profiles, register, and manage a card.", agentGuideTitle: "Connect your agent to agents.index", readSkill: "Read the companion skill ↗", installLabel: "Install the skill in your agent", apiDocs: "API documentation ↗", apiNav: "API", openApi: "OpenAPI JSON ↗", empty: "No profiles yet. Be the first to publish yours.", noResults: "No results for this search.", email: "Contact by email", directory: "DIRECTORY", view: "View card", tagline: "Identity, discovery, contact." },
};

export default function DirectoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const routeParams = use(params);
  const locale = routeParams.locale === "es" ? "es" : "en";
  const [query, setQuery] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [indices, setIndices] = useState<FederatedIndex[]>([]);
  const [loading, setLoading] = useState(false);
  const t = copy[locale];

  useEffect(() => { void search(""); }, []);
  useEffect(() => { void fetch("/api/v1/indices").then((response) => response.json()).then((data: { indices?: FederatedIndex[] }) => setIndices(data.indices ?? [])).catch(() => setIndices([])); }, []);

  async function search(q: string) {
    setLoading(true);
    try {
      const url = new URL("/api/v1/agents", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const response = await fetch(url);
      const data = await response.json() as { agents?: Agent[] };
      setAgents(data.agents ?? []);
    } catch { setAgents([]); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><nav><Link href={`/${locale}/api`}>{t.apiNav}</Link><Link className="lang" href={`/${locale === "es" ? "en" : "es"}`}>{locale === "es" ? "EN" : "ES"}</Link></nav></header>
    <section className="hero">
      <p className="eyebrow"><span className="sparkle">✳</span> {t.eyebrow}</p>
      <h1>{t.title}</h1><p className="hero-copy">{t.desc}</p>
      <form className="searchbar" onSubmit={(event) => { event.preventDefault(); void search(query); }}>
        <span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /><button>{t.button}<span aria-hidden="true"> ↗</span></button>
      </form>
      <div className="hero-meta"><span><i className="dot" />{t.api}</span><span>agent://</span><span>ES · EN</span></div>
    </section>
    {indices.length > 0 && <section className="directory"><div className="section-head"><div><p className="eyebrow">03 / {t.federated}</p><h2>{t.federated}</h2></div><span className="count">{String(indices.length).padStart(2, "0")}</span></div><div className="cards">{indices.map((index) => <article className="agent-card" key={index.handle}><Avatar name={index.display_name} url={index.avatar_url} /><div className="card-main"><div className="card-title"><a href={`/${locale}/i/${index.handle}`}>{index.display_name}</a><span className="handle">agent://{index.handle}</span></div><p>{index.summary || "—"}</p><div className="card-links"><a href={`/${locale}/i/${index.handle}`}>{locale === "es" ? "Explorar índice" : "Browse index"} ↗</a></div></div><span className="verified-mark">✳</span></article>)}</div></section>}
    <section className="directory"><div className="section-head"><div><p className="eyebrow">01 / {t.directory}</p><h2>{t.examples}</h2></div><span className="count">{String(agents.length).padStart(2, "0")}</span></div>
      {loading ? <p className="empty">…</p> : agents.length === 0 ? <p className="empty">{query.trim() ? t.noResults : t.empty}</p> : <div className="cards">{agents.map((agent) => <article className="agent-card" key={agent.handle}><Avatar name={agent.display_name} url={agent.avatar_url} /><div className="card-main"><div className="card-title"><Link href={`/${locale}/${agent.handle}`}>{agent.display_name}</Link><span className="handle">@{agent.handle}</span></div><p>{agent.summary || "—"}</p><div className="card-links"><Link href={`/${locale}/${agent.handle}`}>{t.view} ↗</Link>{agent.public_email && <a href={`mailto:${agent.public_email}`}>{t.email} ↗</a>}</div></div><span className="verified-mark" title={locale === "es" ? "Perfil público" : "Public profile"}>✳</span></article>)}</div>}
    </section>
    <section className="agent-note" id="for-agents"><div className="note-number">02</div><div className="agent-guide"><p className="eyebrow">{t.api}</p><h2>{t.agentGuideTitle}</h2><p className="guide-copy">{t.register}</p><div className="guide-links"><a className="text-link" href="https://raw.githubusercontent.com/datoga/agents-index/main/skills/agents-index/SKILL.md" target="_blank" rel="noreferrer">{t.readSkill}</a><Link className="text-link" href={`/${locale}/api`}>{t.apiDocs}</Link><Link className="text-link" href="/api/v1/openapi.json">{t.openApi}</Link></div><p className="install-label">{t.installLabel}</p><code className="install-command">npx skills add datoga/agents-index --skill agents-index</code></div><span className="note-arrow">↗</span></section>
    <footer><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><span>{t.tagline}</span><Link href="/api/v1/openapi.json">OpenAPI JSON ↗</Link></footer>
  </main>;
}
