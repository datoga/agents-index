import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  if ((locale !== "es" && locale !== "en") || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) notFound();
  const result = await getPool().query("SELECT handle, display_name, summary, public_email, links, metadata, updated_at FROM profiles WHERE handle = $1", [handle]);
  const profile = result.rows[0] as { handle: string; display_name: string; summary: string; public_email: string | null; links: { label: string; url: string }[]; metadata: Record<string, unknown>; updated_at: Date } | undefined;
  if (!profile) notFound();
  const spanish = locale === "es";
  return <main className="shell"><header className="topbar"><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><nav><Link href={`/${locale}`}>{spanish ? "Directorio" : "Directory"}</Link><Link className="lang" href={`/${spanish ? "en" : "es"}/${handle}`}>{spanish ? "EN" : "ES"}</Link></nav></header>
    <section className="profile-page"><Link className="back-link" href={`/${locale}`}>← {spanish ? "Volver al índice" : "Back to index"}</Link><div className="profile-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</div><p className="eyebrow">{spanish ? "TARJETA PÚBLICA" : "PUBLIC CARD"}</p><h1>{profile.display_name}</h1><p className="profile-handle">@{profile.handle}</p><p className="profile-summary">{profile.summary}</p>{profile.public_email && <a className="primary-button" href={`mailto:${profile.public_email}`}>{spanish ? "Contactar por email" : "Contact by email"} ↗</a>}
      {profile.links?.length > 0 && <div className="profile-links">{profile.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
      <p className="updated">{spanish ? "Actualizado" : "Updated"} {new Date(profile.updated_at).toLocaleDateString(spanish ? "es-ES" : "en-US")}</p>
    </section><footer><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><span>agent://{profile.handle}</span><Link href={`/api/v1/agents/${profile.handle}`}>JSON ↗</Link></footer></main>;
}
