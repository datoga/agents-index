import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/public-profile";
import { getProfileIndex } from "@/lib/federation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }): Promise<Metadata> {
  const { locale, handle } = await params;
  if ((locale !== "es" && locale !== "en") || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) {
    return { robots: { index: false, follow: false } };
  }
  const profile = await getPublicProfile(handle);
  if (!profile) return { title: "Profile not found", robots: { index: false, follow: false } };

  const spanish = locale === "es";
  const title = `${profile.display_name} (@${profile.handle})`;
  const description = profile.summary.slice(0, 200) || (spanish ? "Tarjeta pública en agents.index." : "Public agent card on agents.index.");
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/${handle}`,
      languages: { "es-ES": `/es/${handle}`, "en-US": `/en/${handle}` },
    },
    openGraph: {
      type: "website",
      siteName: "agents.index",
      title: `${title} | agents.index`,
      description,
      locale: spanish ? "es_ES" : "en_US",
    },
    twitter: { title: `${title} | agents.index`, description },
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  if ((locale !== "es" && locale !== "en") || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) notFound();
  const profile = await getPublicProfile(handle);
  if (!profile) notFound();
  const index = await getProfileIndex(handle);
  const spanish = locale === "es";
  return <main className="shell"><header className="topbar"><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><nav><Link href={`/${locale}`}>{spanish ? "Directorio" : "Directory"}</Link><Link className="lang" href={`/${spanish ? "en" : "es"}/${handle}`}>{spanish ? "EN" : "ES"}</Link></nav></header>
    <section className="profile-page"><Link className="back-link" href={`/${locale}`}>← {spanish ? "Volver al índice" : "Back to index"}</Link><div className="profile-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</div><p className="eyebrow">{spanish ? "TARJETA PÚBLICA" : "PUBLIC CARD"}</p><h1>{profile.display_name}</h1><p className="profile-handle">@{profile.handle}</p><p className="profile-summary">{profile.summary}</p>{profile.public_email && <a className="primary-button" href={`mailto:${profile.public_email}`}>{spanish ? "Contactar por email" : "Contact by email"} ↗</a>}
      {index && <a className="primary-button" href={`/${locale}/i/${index.handle}`}>{spanish ? "Explorar este índice" : "Browse this index"} ↗</a>}
      {profile.links?.length > 0 && <div className="profile-links">{profile.links.map((link) => <a key={link.url} href={link.url.startsWith("agent://") ? `/${locale}/resolve?uri=${encodeURIComponent(link.url)}` : link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div>}
      <p className="updated">{spanish ? "Actualizado" : "Updated"} {new Date(profile.updated_at).toLocaleDateString(spanish ? "es-ES" : "en-US")}</p>
    </section><footer><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><span>agent://{profile.handle}</span><Link href={`/api/v1/agents/${profile.handle}`}>JSON ↗</Link></footer></main>;
}
