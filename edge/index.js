// ESA Functions + Pages entry.
// Serves /api/* while static assets are served from ./out

const DEFAULT_TTL_MS = 8 * 60 * 1000;
const KV_NAMESPACE = "esa-ai-generator";

function nowMs() {
  const p = globalThis?.performance;
  if (p && typeof p.now === 'function') return p.now();
  return Date.now();
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function firstIp(xff) {
  if (!xff) return null;
  const first = xff.split(",")[0]?.trim();
  return first || null;
}

function parseFloatOrNull(v) {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function decodeURIComponentSafely(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function getCache() {
  const c = globalThis?.caches?.default;
  return c || null;
}

function getMem() {
  const g = globalThis;
  if (!g.__EDGE_MEM_CACHE) g.__EDGE_MEM_CACHE = new Map();
  return g.__EDGE_MEM_CACHE;
}

function getKv() {
  try {
    if (typeof EdgeKV === "undefined") return null;
    return new EdgeKV({ namespace: KV_NAMESPACE });
  } catch {
    return null;
  }
}

async function kvGetJson(kv, key) {
  try {
    const v = await kv.get(key, { type: "json" });
    return v ?? null;
  } catch {
    return null;
  }
}

async function kvPutJson(kv, key, obj) {
  try {
    await kv.put(key, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}
async function edgeCacheGet(keyUrl) {
  const cache = getCache();
  if (cache) {
    const req = new Request(keyUrl, { method: "GET" });
    const res = await cache.match(req);
    if (!res) return { hit: false };
    try {
      const json = await res.json();
      if (!json || typeof json.expiresAt !== "number") return { hit: false };
      if (Date.now() > json.expiresAt) return { hit: false };
      return { hit: true, value: json.value };
    } catch {
      return { hit: false };
    }
  }

  const mem = getMem();
  const entry = mem.get(keyUrl);
  if (!entry) return { hit: false };
  if (Date.now() > entry.expiresAt) return { hit: false };
  return { hit: true, value: entry.value };
}

async function edgeCachePut(keyUrl, value, ttlMs) {
  const cache = getCache();
  const expiresAt = Date.now() + ttlMs;

  if (cache) {
    const req = new Request(keyUrl, { method: "GET" });
    const envelope = { expiresAt, value };
    const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000));
    const res = new Response(JSON.stringify(envelope), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=0, s-maxage=${ttlSeconds}`
      }
    });
    await cache.put(req, res);
    return;
  }

  getMem().set(keyUrl, { expiresAt, value });
}

async function sha256Base64Url(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeUtf8(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function coerceString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function pickShareCore(payload) {
  const prompt = coerceString(payload?.prompt).trim();
  const lang = (coerceString(payload?.lang, "en").trim() || "en").slice(0, 12);

  const loc = payload?.location ?? {};
  const weather = payload?.weather ?? {};
  const content = payload?.content ?? {};

  return {
    v: 1,
    prompt,
    lang,
    location: {
      city: typeof loc.city === "string" ? loc.city : null,
      country: typeof loc.country === "string" ? loc.country : null,
      region: typeof loc.region === "string" ? loc.region : null,
      latitude: typeof loc.latitude === "number" ? loc.latitude : null,
      longitude: typeof loc.longitude === "number" ? loc.longitude : null
    },
    weather: {
      temperatureC: typeof weather.temperatureC === "number" ? weather.temperatureC : null,
      weatherCode: typeof weather.weatherCode === "number" ? weather.weatherCode : null,
      description: coerceString(weather.description, "Unknown")
    },
    content: {
      text: coerceString(content.text),
      model: coerceString(content.model, "unknown"),
      mode: content?.mode === "qwen" ? "qwen" : "mock"
    },
    generatedAt: coerceString(payload?.generatedAt, new Date().toISOString())
  };
}

async function computeShareId(payload) {
  const core = pickShareCore(payload);
  return sha256Base64Url(JSON.stringify(core));
}

function encodeShareDataForUrl(payload) {
  const core = pickShareCore(payload);
  return base64UrlEncodeUtf8(JSON.stringify(core));
}

function decodeShareDataFromUrl(d) {
  try {
    if (!d || typeof d !== "string") return null;
    if (d.length > 12000) return null;
    const jsonStr = base64UrlDecodeUtf8(d);
    const obj = JSON.parse(jsonStr);
    if (!obj || obj.v !== 1) return null;
    if (typeof obj.prompt !== "string" || !obj.prompt.trim()) return null;
    if (typeof obj.lang !== "string" || !obj.lang.trim()) return null;
    if (!obj.location || typeof obj.location !== "object") return null;
    if (!obj.weather || typeof obj.weather !== "object") return null;
    if (!obj.content || typeof obj.content !== "object") return null;
    return pickShareCore(obj);
  } catch {
    return null;
  }
}

function shareKey(id) { return `share_${id}`; }

function viewKey(id) { return `views_${id}`; }

async function saveShare(payload, ttlMs) {
  const id = await computeShareId(payload);

  const kv = getKv();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  if (kv) {
    const existing = await kvGetJson(kv, shareKey(id));
    const stillValid = existing && typeof existing.expiresAt === "number" && existing.expiresAt > now;
    if (!stillValid) {
      await kvPutJson(kv, shareKey(id), { expiresAt, payload });
    }
    return id;
  }

  const existing = await edgeCacheGet(`https://edge-cache.local/share/${encodeURIComponent(id)}`);
  if (!existing.hit) {
    await edgeCachePut(`https://edge-cache.local/share/${encodeURIComponent(id)}`, { payload }, ttlMs);
  }
  return id;
}

function buildShareUrl(id, d) {
  const qp = new URLSearchParams();
  qp.set("id", id);
  if (d) qp.set("d", d);
  return `/s/?${qp.toString()}`;
}

async function getShare(id) {
  const now = Date.now();
  const kv = getKv();
  if (kv) {
    const v = await kvGetJson(kv, shareKey(id));
    if (!v || typeof v.expiresAt !== "number" || v.expiresAt <= now) return null;
    return v.payload ?? null;
  }

  const cached = await edgeCacheGet(`https://edge-cache.local/share/${encodeURIComponent(id)}`);
  return cached.hit && cached.value ? cached.value.payload : null;
}

async function getViewCount(id) {
  const now = Date.now();
  const kv = getKv();
  if (kv) {
    const v = await kvGetJson(kv, viewKey(id));
    if (!v || typeof v.expiresAt !== "number" || v.expiresAt <= now) return 0;
    return typeof v.count === "number" ? v.count : 0;
  }

  const cached = await edgeCacheGet(`https://edge-cache.local/views/${encodeURIComponent(id)}`);
  return cached.hit && cached.value ? cached.value.count : 0;
}

async function incrementView(id, ttlMs) {
  const kv = getKv();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  if (kv) {
    const current = await getViewCount(id);
    const next = current + 1;
    await kvPutJson(kv, viewKey(id), { expiresAt, count: next });
    return next;
  }

  const current = await getViewCount(id);
  const next = current + 1;
  await edgeCachePut(`https://edge-cache.local/views/${encodeURIComponent(id)}`, { count: next }, ttlMs);
  return next;
}

async function replayFromD(d, request) {
  const spec = decodeShareDataFromUrl(d);
  if (!spec) return json({ error: "Invalid share payload" }, { status: 400 });

  const started = nowMs();
  const edge = getEdgeInfo(request.headers);

  const id = await computeShareId(spec);
  const views = await getViewCount(id);

  const location = {
    ...spec.location,
    ip: null,
    source: "share"
  };

  const locLabel = `${location.city || "unknown"}-${location.country || "unknown"}-${(location.latitude || 0).toFixed(2)}-${(location.longitude || 0).toFixed(2)}`;
  const key = await cacheKeyFor({ prompt: spec.prompt, lang: spec.lang, location: locLabel });

  return json({
    prompt: spec.prompt,
    lang: spec.lang,
    location,
    weather: spec.weather,
    edge,
    cache: { hit: true, ttlMs: DEFAULT_TTL_MS, key },
    content: spec.content,
    share: { id, url: buildShareUrl(id, d), views },
    timing: {
      totalMs: Math.round(nowMs() - started),
      geoMs: 0,
      weatherMs: 0,
      aiMs: 0,
      originSimulatedMs: simulateOriginMs(Math.round(nowMs() - started), true)
    },
    generatedAt: spec.generatedAt
  });
}

function describeWeather(code) {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snow fall";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return `Weather code ${code}`;
}

async function detectLocation(request) {
  const h = request.headers;

  const ip = firstIp(h.get("x-forwarded-for")) || h.get("true-client-ip") || null;
  const city = h.get("x-esa-city") || h.get("x-client-city") || h.get("cf-ipcity") || null;
  const country = h.get("x-esa-country") || h.get("cf-ipcountry") || null;
  const region = h.get("x-esa-region") || h.get("cf-region") || null;
  const latitude = parseFloatOrNull(h.get("x-esa-latitude")) || parseFloatOrNull(h.get("cf-iplatitude")) || null;
  const longitude = parseFloatOrNull(h.get("x-esa-longitude")) || parseFloatOrNull(h.get("cf-iplongitude")) || null;

  const fromHeaders = {
    city: city ? decodeURIComponentSafely(city) : null,
    country: country ? decodeURIComponentSafely(country) : null,
    region: region ? decodeURIComponentSafely(region) : null,
    latitude,
    longitude,
    ip,
    source: city || country || latitude != null || longitude != null ? "headers" : "unknown"
  };

  const needsFallback = !fromHeaders.city || fromHeaders.latitude == null || fromHeaders.longitude == null;
  if (!needsFallback) return fromHeaders;

  const cacheKey = `https://edge-cache.local/geo/${encodeURIComponent(ip || "self")}`;
  const cached = await edgeCacheGet(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  const merged = {
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

async function getWeather(latitude, longitude) {
  const latKey = latitude.toFixed(2);
  const lonKey = longitude.toFixed(2);
  const cacheKey = `https://edge-cache.local/weather/${latKey},${lonKey}`;

  const cached = await edgeCacheGet(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  const temperatureC = typeof json?.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
  const weatherCode = typeof json?.current?.weather_code === "number" ? json.current.weather_code : null;

  const info = { temperatureC, weatherCode, description: describeWeather(weatherCode) };
  await edgeCachePut(cacheKey, info, 10 * 60 * 1000);
  return info;
}

async function generateWithQwen({ apiKey, model, messages }) {
  const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: { messages },
      parameters: { temperature: 0.8, top_p: 0.9, result_format: "message" }
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DashScope error: ${res.status} ${err}`);
  }

  const json = await res.json().catch(() => null);
  const choiceText = json?.output?.choices?.[0]?.message?.content ?? json?.output?.choices?.[0]?.text ?? json?.output?.text ?? null;
  if (!choiceText || typeof choiceText !== "string") {
    throw new Error(`DashScope invalid response: ${json?.code ?? ""} ${json?.message ?? ""}`.trim());
  }
  return { text: choiceText.trim(), model };
}

function simulateOriginMs(edgeComputeMs, cacheHit) {
  // Centralized region typically adds extra WAN RTT; cache hits reduce compute but still pay network.
  const extraBase = cacheHit ? 350 : 650;
  const extraJitter = cacheHit ? 250 : 650;
  return edgeComputeMs + extraBase + Math.floor(Math.random() * extraJitter);
}

function buildSystemPrompt(lang) {
  return [
    "You are an award-winning creative writer and practical advisor.",
    "Generate a concise, vivid, useful response tailored to the user.",
    "Always reflect the given location and live weather.",
    "Output must be in the target language:",
    `LANGUAGE=${lang}`,
    "Format: a short title line, then 6-10 bullet points or short paragraphs, then a 1-line closing."
  ].join("\n");
}

function buildUserPrompt({ prompt, location, weather, lang }) {
  const where = `${location.city ?? "Unknown city"}, ${location.country ?? "Unknown country"}`;
  const temp = weather.temperatureC == null ? "unknown" : `${Math.round(weather.temperatureC)}C`;
  return [
    `User prompt: ${prompt}`,
    `Context: You are located in ${where}. Weather: ${weather.description}, ${temp}.`,
    `Target language: ${lang}.`,
    "Make it feel local and actionable (places, timing, what to do now)."
  ].join("\n");
}

function mockGenerate({ prompt, location, weather, lang }) {
  const city = location.city ?? "your city";
  const country = location.country ?? "your country";
  const temp = weather.temperatureC == null ? "unknown" : `${Math.round(weather.temperatureC)}°C`;

  if (String(lang).startsWith("zh")) {
    return [
      `《${city} 的即时灵感》`,
      `你在：${city}，${country}`,
      `天气：${weather.description}，${temp}`,
      "",
      "建议：",
      "- 先用 10 分钟“就近漫步”：找一个离你最近的街区/公园，观察 3 个细节（颜色、声音、气味）。",
      "- 如果你要旅行/出行：把行程拆成“1 个主目标 + 2 个备选”，天气变化就切换备选。",
      "- 现在就做一件可执行的小事：根据天气调整衣物/雨具，然后出门买一杯当地常见饮品。",
      `- 写一句“当地化”的记录：今天的 ${city} 像……（用一个比喻）。`,
      "",
      `你的原始提示词：${prompt}`
    ].join("\n");
  }

  return [
    `A micro-local plan for ${city}`,
    `Location: ${city}, ${country}`,
    `Weather now: ${weather.description}, ${temp}`,
    "",
    "- Do a 10-minute “nearby walk”: notice 3 details (colors, sounds, smells).",
    "- If you’re traveling: keep 1 primary goal + 2 weather-proof alternates.",
    "- Make one immediate action: adjust clothing/umbrella, then try a local staple drink/snack.",
    `- Capture a 1-line story: “Today in ${city} feels like …”`,
    "",
    `Your prompt: ${prompt}`
  ].join("\n");
}

function getEdgeInfo(headers) {
  const esa = headers.get("x-esa-edge-location") || headers.get("x-esa-region") || null;
  if (esa) return { provider: "ESA Edge", node: esa, requestId: null };

  const cfRay = headers.get("cf-ray");
  if (cfRay) {
    const parts = cfRay.split("-");
    const colo = parts[1] || "Cloudflare";
    return { provider: "Cloudflare Edge", node: colo, requestId: cfRay };
  }

  return { provider: "Edge", node: "near-user", requestId: null };
}

async function cacheKeyFor({ prompt, lang, location }) {
  const buf = new TextEncoder().encode(`${lang}|${location}|${prompt}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `https://edge-cache.local/gen/${b64}`;
}

function envGet(env, name) {
  try {
    const v = env?.[name];
    if (typeof v === "string" && v) return v;
    if (v != null) return String(v);
  } catch {
    // ignore
  }

  try {
    const pv = globalThis?.process?.env?.[name];
    if (typeof pv === "string") return pv;
  } catch {
    // ignore
  }

  return "";
}

async function handleGenerate(request, env) {
  const url = new URL(request.url);
  let prompt = (url.searchParams.get("prompt") || "").trim();
  let lang = (url.searchParams.get("lang") || "en").trim() || "en";

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.prompt === "string") prompt = body.prompt.trim();
    if (typeof body?.lang === "string") lang = body.lang.trim() || lang;
  }

  if (!prompt) return json({ error: "Missing prompt" }, { status: 400 });

  const started = nowMs();
  const edge = getEdgeInfo(request.headers);

  const geoStart = nowMs();
  const location = await detectLocation(request);
  const geoMs = Math.round(nowMs() - geoStart);

  const locLabel = `${location.city || "unknown"}-${location.country || "unknown"}-${(location.latitude || 0).toFixed(2)}-${(location.longitude || 0).toFixed(2)}`;
  const key = await cacheKeyFor({ prompt, lang, location: locLabel });

  const cached = await edgeCacheGet(key);
  if (cached.hit && cached.value) {
    const shareId = await saveShare(cached.value, DEFAULT_TTL_MS);
    const views = await getViewCount(shareId);
    const d = encodeShareDataForUrl({ ...cached.value, share: { id: shareId } });
    const shareUrl = d.length <= 6000 ? buildShareUrl(shareId, d) : buildShareUrl(shareId, null);
    return json({
      ...cached.value,
      cache: { hit: true, ttlMs: DEFAULT_TTL_MS, key },
      share: { id: shareId, url: shareUrl, views },
      timing: {
        totalMs: Math.round(nowMs() - started),
        geoMs,
        weatherMs: 0,
        aiMs: 0,
        originSimulatedMs: simulateOriginMs(Math.round(nowMs() - started), true)
      }
    });
  }

  const weatherStart = nowMs();
  const weather =
    location.latitude != null && location.longitude != null
      ? await getWeather(location.latitude, location.longitude)
      : { temperatureC: null, weatherCode: null, description: "Unknown" };
  const weatherMs = Math.round(nowMs() - weatherStart);

  const aiStart = nowMs();
  const apiKey = envGet(env, "DASHSCOPE_API_KEY");
  const model = envGet(env, "AI_TEXT_MODEL") || "qwen-max";

  let contentText;
  let mode = "mock";
  let usedModel = "mock-template";

  if (apiKey) {
    try {
      const sys = buildSystemPrompt(lang);
      const user = buildUserPrompt({ prompt, location, weather, lang });
      const out = await generateWithQwen({
        apiKey,
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ]
      });
      contentText = out.text;
      usedModel = out.model;
      mode = "qwen";
    } catch {
      contentText = mockGenerate({ prompt, location, weather, lang });
    }
  } else {
    contentText = mockGenerate({ prompt, location, weather, lang });
  }

  const aiMs = Math.round(nowMs() - aiStart);

  const result = {
    prompt,
    lang,
    location,
    weather,
    edge,
    cache: { hit: false, ttlMs: DEFAULT_TTL_MS, key },
    content: { text: contentText, model: usedModel, mode },
    share: { id: null, url: null, views: null },
    timing: {
      totalMs: Math.round(nowMs() - started),
      geoMs,
      weatherMs,
      aiMs,
      originSimulatedMs: simulateOriginMs(Math.round(nowMs() - started), false)
    },
    generatedAt: new Date().toISOString()
  };

  await edgeCachePut(key, result, DEFAULT_TTL_MS);

  const shareId = await saveShare(result, DEFAULT_TTL_MS);
  const views = await getViewCount(shareId);
  const d = encodeShareDataForUrl({ ...result, share: { id: shareId } });
  const shareUrl = d.length <= 6000 ? buildShareUrl(shareId, d) : buildShareUrl(shareId, null);
  const final = { ...result, share: { id: shareId, url: shareUrl, views } };

  await edgeCachePut(key, final, DEFAULT_TTL_MS);
  return json(final);
}

async function handleReplay(request) {
  const url = new URL(request.url);
  const d = (url.searchParams.get("d") || "").trim();
  if (!d) return json({ error: "Missing d" }, { status: 400 });
  return replayFromD(d, request);
}

async function handleShare(request) {
  const url = new URL(request.url);

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    if (!payload) return json({ error: "Missing payload" }, { status: 400 });
    const id = await saveShare(payload, 10 * 60 * 1000);
    const d = encodeShareDataForUrl({ ...payload, share: { id } });
    const shareUrl = d.length <= 6000 ? buildShareUrl(id, d) : buildShareUrl(id, null);
    return json({ id, url: shareUrl });
  }

  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  const res = await getShare(id);
  if (res) return json(res);

  const d = (url.searchParams.get("d") || "").trim();
  if (d) return replayFromD(d, request);

  return json({ error: "Not found" }, { status: 404 });
}

async function handleShareById(id, request) {
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  const res = await getShare(id);
  if (res) return json(res);

  const url = new URL(request.url);
  const d = (url.searchParams.get("d") || "").trim();
  if (d) return replayFromD(d, request);

  return json({ error: "Not found" }, { status: 404 });
}

async function handleViews(id, request) {
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  if (request.method === "POST") {
    const count = await incrementView(id, 24 * 60 * 60 * 1000);
    return json({ id, count });
  }

  const count = await getViewCount(id);
  return json({ id, count });
}

function notFound() {
  return json({ error: "Not found" }, { status: 404 });
}

async function routeFetch(request, env) {
  const url = new URL(request.url);

  // If ESA ever routes non-API requests here, only handle /api/*.
  if (!url.pathname.startsWith("/api/")) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (url.pathname === "/api/generate") return handleGenerate(request, env);
  if (url.pathname === "/api/replay") return handleReplay(request);
  if (url.pathname === "/api/share") return handleShare(request);

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[1] === "share" && parts.length === 3 && request.method === "GET") return handleShareById(parts[2], request);
  if (parts[1] === "view" && parts.length === 3 && (request.method === "GET" || request.method === "POST")) {
    return handleViews(parts[2], request);
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    return routeFetch(request, env);
  }
};





