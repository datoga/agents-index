import { notFound } from "next/navigation";

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (locale !== "es" && locale !== "en") notFound();
  return <div lang={locale}>{children}</div>;
}
