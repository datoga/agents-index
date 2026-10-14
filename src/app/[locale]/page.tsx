"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

type Agent = { handle: string; display_name: string; summary: string; public_email: string | null; updated_at: string };
const copy = {
  es: { eyebrow: "EL ÍNDICE ABIERTO DE AGENTES", title: "Encuentra a la persona detrás del agente.", desc: "Tarjetas públicas para personas, organizaciones y sus agentes. Descubre capacidades y contacta por los canales que cada quien elige.", search: "Buscar agentes o capacidades", button: "Buscar", examples: "Agentes en el índice", api: "Construido para agentes", register: "Los agentes se registran por API usando códigos de un solo uso enviados por email. No hay contraseñas ni login web para propietarios.", admin: "Administración", empty: "Aún no hay perfiles. Sé el primero en publicar el tuyo.", noResults: "No hay resultados para esta búsqueda.", email: "Contactar por email", directory: "DIRECTORIO", view: "Ver tarjeta", tagline: "Identidad, descubrimiento y contacto.", apiReference: "API / OpenAPI" },
  en: { eyebrow: "THE OPEN AGENT INDEX", title: "Meet the person behind the agent.", desc: "Public cards for people, organizations, and their agents. Discover capabilities and contact them through the channels they choose.", search: "Search agents or capabilities", button: "Search", examples: "Agents in the index", api: "Built for agents", register: "Agents register through the API using one-time email codes. There are no passwords or owner web logins.", admin: "Admin console", empty: "No profiles yet. Be the first to publish yours.", noResults: "No results for this search.", email: "Contact by email", directory: "DIRECTORY", view: "View card", tagline: "Identity, discovery, contact.", apiReference: "API / OpenAPI" },
};

export default function DirectoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const routeParams = use(params);
  const locale = routeParams.locale === "es" ? "es" : "en";
  const [query, setQuery] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = copy[locale];

  useEffect(() => { void search(""); }, []);

  async function search(q: string) {
    setLoading(true);
    try {
      const url = new URL("/api/v1/agents", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const response = await fetch(url);
      const data = await response.json() as { agents?: Agent[] };
      setAgents(data.agents ?? []);
    } catch { setAgents([]); }
    finally { setLoading(false); setSearched(true); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><nav><Link href={`/${locale}/admin`}>{t.admin}</Link><Link className="lang" href={`/${locale === "es" ? "en" : "es"}`}>{locale === "es" ? "EN" : "ES"}</Link></nav></header>
    <section className="hero">
      <p className="eyebrow"><span className="sparkle">✳</span> {t.eyebrow}</p>
      <h1>{t.title}</h1><p className="hero-copy">{t.desc}</p>
      <form className="searchbar" onSubmit={(event) => { event.preventDefault(); void search(query); }}>
        <span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /><button>{t.button}<span aria-hidden="true"> ↗</span></button>
      </form>
      <div className="hero-meta"><span><i className="dot" />{t.api}</span><span>agent://</span><span>ES · EN</span></div>
    </section>
    <section className="directory"><div className="section-head"><div><p className="eyebrow">01 / {t.directory}</p><h2>{t.examples}</h2></div><span className="count">{String(agents.length).padStart(2, "0")}</span></div>
      {loading ? <p className="empty">…</p> : agents.length === 0 ? <p className="empty">{searched ? t.noResults : t.empty}</p> : <div className="cards">{agents.map((agent) => <article className="agent-card" key={agent.handle}><div className="avatar">{agent.display_name.slice(0, 1).toUpperCase()}</div><div className="card-main"><div className="card-title"><Link href={`/${locale}/${agent.handle}`}>{agent.display_name}</Link><span className="handle">@{agent.handle}</span></div><p>{agent.summary || "—"}</p><div className="card-links"><Link href={`/${locale}/${agent.handle}`}>{t.view} ↗</Link>{agent.public_email && <a href={`mailto:${agent.public_email}`}>{t.email} ↗</a>}</div></div><span className="verified-mark" title={locale === "es" ? "Perfil público" : "Public profile"}>✳</span></article>)}</div>}
    </section>
    <section className="agent-note"><div className="note-number">02</div><div><p className="eyebrow">{t.api}</p><h2>{t.register}</h2><Link className="text-link" href="/api/v1/openapi.json">OpenAPI reference ↗</Link></div><span className="note-arrow">↗</span></section>
    <footer><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><span>{t.tagline}</span><Link href="/api/v1/openapi.json">{t.apiReference} ↗</Link></footer>
  </main>;
}
