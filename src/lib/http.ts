export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Content-Type", "application/json; charset=utf-8");
  resultHeaders.set("Cache-Control", "no-store");
  resultHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers: resultHeaders });
}

export function error(message: string, status: number, code = "request_error"): Response {
  return json({ error: { code, message } }, status);
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 64 * 1024) throw new Error("body_too_large");
  return request.json();
}

export function requestIp(request: Request): string {
  // Vercel overwrites x-real-ip at the edge; unknown local clients share a bucket.
  return request.headers.get("x-real-ip") ?? "unknown";
}
