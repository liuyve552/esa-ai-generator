import { edgeCacheGet, edgeCachePut } from "@/lib/edge/cache";
import type { LocationInfo } from "@/lib/edge/types";

type IpWhoIsResponse = {
  success?: boolean;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

function firstIp(xff: string | null): string | null {
  if (!xff) return null;
  const first = xff.split(",")[0]?.trim();
  if (!first) return null;
  return first;
}

function parseFloatOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function decodeURIComponentSafely(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function detectLocation(request: Request): Promise<LocationInfo> {
  const h = request.headers;

  const ip = firstIp(h.get("x-forwarded-for")) ?? h.get("true-client-ip") ?? null;
  const city = h.get("x-vercel-ip-city") ?? h.get("cf-ipcity") ?? h.get("x-client-city") ?? null;
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? null;
  const region = h.get("x-vercel-ip-country-region") ?? h.get("cf-region") ?? null;
  const latitude =
    parseFloatOrNull(h.get("x-vercel-ip-latitude")) ?? parseFloatOrNull(h.get("cf-iplatitude")) ?? null;
  const longitude =
    parseFloatOrNull(h.get("x-vercel-ip-longitude")) ?? parseFloatOrNull(h.get("cf-iplongitude")) ?? null;

  const fromHeaders: LocationInfo = {
    city: city ? decodeURIComponentSafely(city) : null,
    country: country ? decodeURIComponentSafely(country) : null,
    region: region ? decodeURIComponentSafely(region) : null,
    latitude,
    longitude,
    ip,
    source: city || country || latitude || longitude ? "headers" : "unknown"
  };

  const needsFallback = !fromHeaders.city || fromHeaders.latitude == null || fromHeaders.longitude == null;
  if (!needsFallback) return fromHeaders;

  const cacheKey = `https://edge-cache.local/geo/${encodeURIComponent(ip ?? "self")}`;
  const cached = await edgeCacheGet<LocationInfo>(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
  const res = await fetch(url, { cache: "force-cache", next: { revalidate: 600 } });
  const data = (await res.json().catch(() => null)) as IpWhoIsResponse | null;

  const merged: LocationInfo = {
    city: fromHeaders.city ?? (data?.city ?? null),
    country: fromHeaders.country ?? (data?.country ?? null),
    region: fromHeaders.region ?? (data?.region ?? null),
    latitude: fromHeaders.latitude ?? (typeof data?.latitude === "number" ? data.latitude : null),
    longitude: fromHeaders.longitude ?? (typeof data?.longitude === "number" ? data.longitude : null),
    ip: fromHeaders.ip ?? (data?.ip ?? null),
    source: data?.success === false ? fromHeaders.source : "ip_api"
  };

  await edgeCachePut(cacheKey, merged, 10 * 60 * 1000);
  return merged;
}
