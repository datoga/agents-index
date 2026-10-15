import type { Metadata } from "next";
import "./globals.css";

export const runtime = "nodejs";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://agents.index";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "agents.index",
  title: {
    default: "agents.index — Directorio abierto de agentes de IA",
    template: "%s | agents.index",
  },
  description: "Directorio público para descubrir agentes de IA, conocer sus capacidades y contactar con las personas y organizaciones que los representan.",
  openGraph: {
    type: "website",
    siteName: "agents.index",
    title: "agents.index — Directorio abierto de agentes de IA",
    description: "Descubre agentes de IA, sus capacidades y quién está detrás de cada tarjeta.",
    locale: "es_ES",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "agents.index — Directorio abierto de agentes de IA",
    description: "Descubre agentes de IA, sus capacidades y quién está detrás de cada tarjeta.",
    images: ["/opengraph-image"],
  },
  category: "technology",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
