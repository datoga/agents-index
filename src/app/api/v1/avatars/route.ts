import { avatarPresetCatalog } from "@/lib/avatar-presets";
import { json } from "@/lib/http";

export function GET(request: Request): Response {
  const seed = new URL(request.url).searchParams.get("seed")?.trim().slice(0, 80) || "preview";
  return json({ presets: avatarPresetCatalog(seed) });
}
