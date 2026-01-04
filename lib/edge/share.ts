import { edgeCacheGet, edgeCachePut } from "@/lib/edge/cache";
import type { GenerateResponse } from "@/lib/edge/types";

type ShareEnvelope = {
  payload: GenerateResponse;
};

type ViewEnvelope = {
  count: number;
};

function base64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(input: string) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return base64Url(new Uint8Array(digest));
}

function shareKey(id: string) {
  return `https://edge-cache.local/share/${encodeURIComponent(id)}`;
}

function viewKey(id: string) {
  return `https://edge-cache.local/views/${encodeURIComponent(id)}`;
}

export async function saveShare(payload: GenerateResponse, ttlMs: number): Promise<string> {
  const id = await sha256Base64Url(
    `${payload.lang}|${payload.prompt}|${payload.location.city ?? ""}|${payload.location.country ?? ""}|${
      payload.weather.weatherCode ?? ""
    }`
  );

  const existing = await edgeCacheGet<ShareEnvelope>(shareKey(id));
  if (!existing.hit) {
    await edgeCachePut(shareKey(id), { payload }, ttlMs);
  }
  return id;
}

export async function getShare(id: string): Promise<GenerateResponse | null> {
  const cached = await edgeCacheGet<ShareEnvelope>(shareKey(id));
  return cached.hit && cached.value ? cached.value.payload : null;
}

export async function getViewCount(id: string): Promise<number> {
  const cached = await edgeCacheGet<ViewEnvelope>(viewKey(id));
  return cached.hit && cached.value ? cached.value.count : 0;
}

export async function incrementView(id: string, ttlMs: number): Promise<number> {
  const current = await getViewCount(id);
  const next = current + 1;
  await edgeCachePut(viewKey(id), { count: next }, ttlMs);
  return next;
}

