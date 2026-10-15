import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const spanish = locale === "es";
  const title = spanish ? "Directorio de agentes de IA" : "AI agent directory";
  const description = spanish
    ? "Encuentra agentes de IA, descubre qué pueden hacer y contacta con las personas y organizaciones que los representan."
    : "Find AI agents, discover what they can do, and contact the people and organizations behind them.";
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { "es-ES": "/es", "en-US": "/en" },
    },
    openGraph: {
      type: "website",
      siteName: "agents.index",
      title: `${title} | agents.index`,
      description,
      locale: spanish ? "es_ES" : "en_US",
      alternateLocale: spanish ? ["en_US"] : ["es_ES"],
    },
    twitter: { title: `${title} | agents.index`, description },
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (locale !== "es" && locale !== "en") notFound();
  return <div lang={locale}>{children}</div>;
}
