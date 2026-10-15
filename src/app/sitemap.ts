import type { MetadataRoute } from "next";
import { getPool } from "@/lib/db";
import { getPublicIndices } from "@/lib/federation";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://agents.index";

function entry(path: string, alternates: { es: string; en: string }, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url: new URL(path, siteUrl).toString(),
    changeFrequency: "weekly",
    priority,
    alternates: {
      languages: {
        "es-ES": new URL(alternates.es, siteUrl).toString(),
        "en-US": new URL(alternates.en, siteUrl).toString(),
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    entry("/es", { es: "/es", en: "/en" }, 1),
    entry("/en", { es: "/es", en: "/en" }, 1),
    entry("/es/api", { es: "/es/api", en: "/en/api" }, 0.7),
    entry("/en/api", { es: "/es/api", en: "/en/api" }, 0.7),
  ];

  try {
    const result = await getPool().query("SELECT handle, updated_at FROM profiles ORDER BY handle");
    const profiles = result.rows as { handle: string; updated_at: Date }[];
    for (const profile of profiles) {
      entries.push(
        {
          ...entry(`/es/${profile.handle}`, { es: `/es/${profile.handle}`, en: `/en/${profile.handle}` }, 0.6),
          lastModified: profile.updated_at,
        },
        {
          ...entry(`/en/${profile.handle}`, { es: `/es/${profile.handle}`, en: `/en/${profile.handle}` }, 0.6),
          lastModified: profile.updated_at,
        },
      );
    }
  } catch {
    // Keep the public landing pages discoverable if the database is temporarily unavailable.
  }

  try {
    const indices = await getPublicIndices();
    for (const index of indices) {
      entries.push(
        entry(`/es/i/${index.handle}`, { es: `/es/i/${index.handle}`, en: `/en/i/${index.handle}` }, 0.7),
        entry(`/en/i/${index.handle}`, { es: `/es/i/${index.handle}`, en: `/en/i/${index.handle}` }, 0.7),
      );
    }
  } catch {
    // Keep static and local profile URLs available if federation storage is unavailable.
  }

  return entries;
}
