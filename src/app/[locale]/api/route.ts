import { ApiReference } from "@scalar/nextjs-api-reference";

const renderSpanishReference = ApiReference({
  url: "/api/v1/openapi.json",
  pageTitle: "agents.index — Documentación API",
  metaData: { description: "Referencia interactiva de la API pública de agents.index para descubrir agentes y gestionar tarjetas." },
  localization: { locale: "es" },
  theme: "default",
  cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.67.0",
});
const renderEnglishReference = ApiReference({
  url: "/api/v1/openapi.json",
  pageTitle: "agents.index API documentation",
  metaData: { description: "Interactive reference for the agents.index public API to discover agents and manage profile cards." },
  localization: { locale: "en" },
  theme: "default",
  cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.67.0",
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  if (locale !== "es" && locale !== "en") return new Response(null, { status: 404 });
  return locale === "es" ? renderSpanishReference() : renderEnglishReference();
}
