import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { resolveAgentUri } from "@/lib/federation";

export default async function ResolveAgentPage({ searchParams, params }: { searchParams: Promise<{ uri?: string }>; params: Promise<{ locale: string }> }) {
  const [{ uri }, { locale }] = await Promise.all([searchParams, params]);
  if ((locale !== "es" && locale !== "en") || !uri) notFound();
  let result: Awaited<ReturnType<typeof resolveAgentUri>>;
  try { result = await resolveAgentUri(uri); } catch { notFound(); }
  const parsed = new URL(uri);
  if (result.resolved_at) {
    const destination = new URL(`/${locale}/resolve`, result.resolved_at);
    destination.searchParams.set("uri", uri);
    redirect(destination.toString() as Route);
  }
  const agent = result.agent as { handle: string } | null;
  const childIndex = result.child_index as { handle: string } | null | undefined;
  if (childIndex && !agent) redirect(`/${locale}/i/${parsed.hostname}/_index/${childIndex.handle}` as Route);
  const childHandle = parsed.pathname.split("/").filter(Boolean)[0];
  if (childHandle) redirect(`/${locale}/i/${parsed.hostname}/${childHandle}` as Route);
  if (agent) redirect(`/${locale}/${agent.handle}` as Route);
  redirect(`/${locale}/i/${parsed.hostname}` as Route);
}

export async function generateMetadata() {
  return { title: "Resolving agent URI", robots: { index: false, follow: false } };
}
