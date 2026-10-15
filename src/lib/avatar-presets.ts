export const AVATAR_PRESETS = [
  { id: "lorelei", label: "Lorelei", style: "lorelei" },
  { id: "pixel-art", label: "Pixel art", style: "pixel-art" },
  { id: "bottts", label: "Bot", style: "bottts-neutral" },
  { id: "micah", label: "Micah", style: "micah" },
  { id: "adventurer", label: "Adventurer", style: "adventurer" },
  { id: "open-peeps", label: "Open Peeps", style: "open-peeps" },
  { id: "thumbs", label: "Thumbs", style: "thumbs" },
  { id: "identicon", label: "Identicon", style: "identicon" },
] as const;

const defaultApiBase = "https://api.dicebear.com/10.x";

function apiBase(): string {
  const configured = process.env.AVATAR_PRESET_API_BASE_URL?.trim();
  return (configured || defaultApiBase).replace(/\/+$/, "");
}

export function getAvatarPreset(id: string) {
  return AVATAR_PRESETS.find((preset) => preset.id === id);
}

export function avatarPresetUrl(id: string, seed: string): string | undefined {
  const preset = getAvatarPreset(id);
  if (!preset) return undefined;
  const url = new URL(`${apiBase()}/${preset.style}/svg`);
  url.searchParams.set("seed", seed);
  url.searchParams.set("backgroundColor", "f4f1eb");
  return url.toString();
}

export function defaultAvatarPreset(handle: string): string {
  let hash = 2166136261;
  for (const char of handle) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return AVATAR_PRESETS[(hash >>> 0) % AVATAR_PRESETS.length]!.id;
}

export function avatarPresetCatalog(seed = "preview") {
  return AVATAR_PRESETS.map(({ id, label }) => ({
    id,
    label,
    url: avatarPresetUrl(id, seed)!,
  }));
}
