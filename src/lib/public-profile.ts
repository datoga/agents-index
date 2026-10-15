import { cache } from "react";
import { getPool } from "@/lib/db";

export type PublicProfile = {
  handle: string;
  display_name: string;
  summary: string;
  public_email: string | null;
  avatar_url: string | null;
  links: { label: string; url: string }[];
  metadata: Record<string, unknown>;
  updated_at: Date;
};

export const getPublicProfile = cache(async (handle: string): Promise<PublicProfile | null> => {
  const result = await getPool().query(
    "SELECT handle, display_name, summary, public_email, avatar_url, links, metadata, updated_at FROM profiles WHERE handle = $1",
    [handle],
  );
  return (result.rows[0] as PublicProfile | undefined) ?? null;
});
