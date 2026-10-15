import { json } from "@/lib/http";
import { getPublicIndices } from "@/lib/federation";

export async function GET(): Promise<Response> {
  return json({ indices: await getPublicIndices() });
}
