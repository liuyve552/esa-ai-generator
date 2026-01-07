// ESA Functions + Pages entry.
// Serves /api/* while static assets are served from ./out

const DEFAULT_TTL_MS = 8 * 60 * 1000;
const KV_NAMESPACE = "esa-ai-generator";
const SUPPORTED_MODES = new Set(["oracle", "travel", "focus", "calm", "card"]);

function normalizeLang(lang) {
  const v = String(lang || "zh").toLowerCase();
  return (v.split("-")[0] || "zh").slice(0, 12);
}

function normalizeMode(mode) {
  const v = String(mode || "oracle").toLowerCase();
  return SUPPORTED_MODES.has(v) ? v : "oracle";
}

function isZhLang(lang) {
  return normalizeLang(lang).startsWith("zh");
}

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
  const lang = normalizeLang(coerceString(payload?.lang, "zh").trim() || "zh");
  const mode = normalizeMode(payload?.mode);

  const loc = payload?.location ?? {};
  const weather = payload?.weather ?? {};
  const content = payload?.content ?? {};

  return {
    v: 1,
    prompt,
    lang,
    mode,
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
      description: coerceString(weather.description, isZhLang(lang) ? "未知" : "Unknown"),
      timezone: typeof weather.timezone === "string" ? weather.timezone : null,
      localTime: typeof weather.localTime === "string" ? weather.localTime : null,
      isDay: typeof weather.isDay === "boolean" ? weather.isDay : null
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

  const palette = pickPalette({ mode: spec.mode, weatherCode: spec.weather.weatherCode, isDay: spec.weather.isDay });
  const daily = makeDaily({ mode: spec.mode, lang: spec.lang, location, weather: spec.weather, palette });
  const visualSeed = `${daily.seed}|${spec.prompt}`;
  const visual = { seed: visualSeed, palette, svg: makeSigilSvg(visualSeed, palette) };
  const stats = makeStats({ lang: spec.lang, location, weather: spec.weather, mode: spec.mode });

  const locLabel = `${location.city || "unknown"}-${location.country || "unknown"}-${(location.latitude || 0).toFixed(2)}-${(location.longitude || 0).toFixed(2)}`;
  const key = await cacheKeyFor({ prompt: spec.prompt, lang: spec.lang, mode: spec.mode, location: locLabel });

  return json({
    prompt: spec.prompt,
    lang: spec.lang,
    mode: spec.mode,
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
    visual,
    daily,
    stats,
    generatedAt: spec.generatedAt
  });
}

function describeWeather(code, lang) {
  const zh = isZhLang(lang);

  if (zh) {
    if (code == null) return "未知";
    if (code === 0) return "晴朗";
    if (code === 1) return "大部晴朗";
    if (code === 2) return "局部多云";
    if (code === 3) return "阴天";
    if (code === 45 || code === 48) return "有雾";
    if (code === 51 || code === 53 || code === 55) return "毛毛雨";
    if (code === 56 || code === 57) return "冻毛毛雨";
    if (code === 61 || code === 63 || code === 65) return "下雨";
    if (code === 66 || code === 67) return "冻雨";
    if (code === 71 || code === 73 || code === 75) return "降雪";
    if (code === 77) return "雪粒";
    if (code === 80 || code === 81 || code === 82) return "阵雨";
    if (code === 85 || code === 86) return "阵雪";
    if (code === 95) return "雷暴";
    if (code === 96 || code === 99) return "雷暴伴冰雹";
    return `天气代码 ${code}`;
  }

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

async function getWeather(latitude, longitude, lang) {
  const langKey = isZhLang(lang) ? "zh" : "en";
  const latKey = latitude.toFixed(2);
  const lonKey = longitude.toFixed(2);
  const cacheKey = `https://edge-cache.local/weather/${langKey}/${latKey},${lonKey}`;

  const cached = await edgeCacheGet(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  const temperatureC = typeof json?.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
  const weatherCode = typeof json?.current?.weather_code === "number" ? json.current.weather_code : null;
  const isDay = json?.current?.is_day === 1 ? true : json?.current?.is_day === 0 ? false : null;
  const timezone = typeof json?.timezone === "string" ? json.timezone : null;
  const localTime = typeof json?.current?.time === "string" ? json.current.time : null;

  const info = { temperatureC, weatherCode, description: describeWeather(weatherCode, langKey), timezone, localTime, isDay };
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

function defaultPromptFor(mode, lang) {
  const m = normalizeMode(mode);
  const zh = isZhLang(lang);
  if (zh) {
    if (m === "travel") return "给我一份今天的本地出行/旅行建议：路线、时间、注意事项，结合实时天气。";
    if (m === "focus") return "给我一个 25 分钟专注清单：开始前 2 分钟准备、25 分钟执行、结束 3 分钟收尾。";
    if (m === "calm") return "给我一段温柔的情绪安抚：呼吸练习 + 一句肯定 + 一个小行动。";
    if (m === "card") return "给我一张适合分享给朋友的城市天气卡片文案：一句标题 + 一段暖心话 + 一句祝福。";
    return "给我一份今日边缘神谕：一句诗 + 三条可执行建议 + 一句可分享的话。";
  }

  if (m === "travel") return "Give me a local travel plan for today: route, timing, and tips based on live weather.";
  if (m === "focus") return "Give me a 25-minute focus checklist: 2-min setup, 25-min execution, 3-min wrap-up.";
  if (m === "calm") return "Give me a gentle calm-down script: breathing + one affirmation + one tiny action.";
  if (m === "card") return "Write a shareable city+weather card: one title, one warm paragraph, one blessing line.";
  return "Give me today’s Edge Oracle: a short poem + 3 actionable tips + 1 shareable line.";
}

function hash32(str) {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function localDateKey(weather) {
  const t = coerceString(weather?.localTime);
  const d = t.includes("T") ? t.split("T")[0] : t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

function pickPalette({ mode, weatherCode, isDay }) {
  const m = normalizeMode(mode);
  const day = isDay !== false;

  const byMode = {
    oracle: { bg: "#0a0716", fg: "#f5f3ff", accent: "#c4b5fd" },
    travel: { bg: "#0b1220", fg: "#eaf2ff", accent: "#fdba74" },
    focus: { bg: "#071018", fg: "#eafff6", accent: "#34d399" },
    calm: { bg: "#07101d", fg: "#eaf2ff", accent: "#60a5fa" },
    card: { bg: "#0b0b12", fg: "#fdf2f8", accent: "#fb7185" }
  }[m];

  const c = weatherCode;
  const byWeather =
    c === 95 || c === 96 || c === 99
      ? { accent: "#c4b5fd" }
      : c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86
        ? { accent: "#a5f3fc" }
        : c === 61 || c === 63 || c === 65 || c === 80 || c === 81 || c === 82
          ? { accent: "#38bdf8" }
          : c === 0 && day
            ? { accent: "#ffd36e" }
            : null;

  return { ...byMode, ...(byWeather || {}) };
}

function makeSigilSvg(seed, palette) {
  const rnd = mulberry32(hash32(seed));
  const a = palette.accent;
  const fg = palette.fg;
  const bg = palette.bg;
  const rings = Array.from({ length: 3 }, (_, i) => {
    const r = 18 + i * 12 + Math.floor(rnd() * 5);
    const op = (0.18 + i * 0.10).toFixed(2);
    return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${a}" stroke-opacity="${op}" stroke-width="1.2" />`;
  }).join("");
  const dots = Array.from({ length: 10 }, () => {
    const x = (12 + rnd() * 96).toFixed(1);
    const y = (12 + rnd() * 96).toFixed(1);
    const r = (1.2 + rnd() * 2.6).toFixed(1);
    const op = (0.12 + rnd() * 0.25).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}" fill-opacity="${op}" />`;
  }).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="sigil">`,
    `<defs><radialGradient id="bg" cx="50%" cy="35%" r="80%"><stop offset="0%" stop-color="${a}" stop-opacity="0.20"/><stop offset="55%" stop-color="${bg}" stop-opacity="1"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="120" height="120" rx="22" fill="url(#bg)"/>`,
    `<g>${rings}</g>`,
    `<g>${dots}</g>`,
    `<path d="M 18 74 C 40 58, 80 92, 102 70" fill="none" stroke="${fg}" stroke-opacity="0.22" stroke-width="1.3" />`,
    `<path d="M 18 48 C 40 64, 80 30, 102 52" fill="none" stroke="${fg}" stroke-opacity="0.16" stroke-width="1.3" />`,
    `</svg>`
  ].join("");
}

function makeDaily({ mode, lang, location, weather, palette }) {
  const zh = isZhLang(lang);
  const m = normalizeMode(mode);
  const date = localDateKey(weather);
  const city = location?.city || (zh ? "你的城市" : "your city");
  const seed = `${date}|${m}|${city}|${weather?.weatherCode ?? "x"}`;
  const rnd = mulberry32(hash32(seed));

  const poolsZh = {
    oracle: ["走到室外 10 分钟，抬头看天空", "给一个人发出一句感谢", "把手机静音 15 分钟", "随手拍 1 张“今天的颜色”", "写下 1 句今天的比喻"],
    travel: ["选一个 2km 内的目的地，走路去", "用 20 分钟逛一条陌生的街", "找个地方坐 5 分钟观察人流", "尝试一家你从没进过的小店", "记录 3 个路牌/店名"],
    focus: ["桌面清空 2 分钟，只留一件事", "打开 25 分钟计时器并开始", "把最难那一步写成一句话", "结束后写下“下一步是什么”", "给自己 3 分钟收尾整理"],
    calm: ["做 4-7-8 呼吸 3 轮", "喝一口温水，放慢 10 秒", "把肩膀放松，伸展 20 秒", "对自己说一句允许的话", "找一个光线柔和的角落停一会儿"],
    card: ["把这张卡发给一个想念的人", "加一句“我在想你”", "用 1 句天气比喻来开头", "附上一句具体的祝福", "今天就把它发出去"]
  };

  const poolsEn = {
    oracle: ["Take a 10-minute walk outside and look up", "Send one sincere thank-you message", "Mute your phone for 15 minutes", "Snap one photo of “today’s color”", "Write one metaphor for today"],
    travel: ["Pick a spot within 2km and walk there", "Explore one unfamiliar street for 20 minutes", "Sit somewhere and observe for 5 minutes", "Try one place you’ve never entered", "Write down 3 street/shop names"],
    focus: ["Clear your desk for 2 minutes", "Start a 25-minute timer and begin", "Turn the hardest step into one sentence", "Afterwards, write the next step", "Do a 3-minute wrap-up tidy"],
    calm: ["Do 3 rounds of 4-7-8 breathing", "Sip warm water and slow down for 10 seconds", "Drop your shoulders and stretch 20 seconds", "Say one allowing sentence to yourself", "Sit in softer light for a moment"],
    card: ["Send this card to someone you miss", "Add one line: “thinking of you”", "Start with a weather metaphor", "End with a specific blessing", "Actually send it today"]
  };

  const pool = (zh ? poolsZh : poolsEn)[m] || (zh ? poolsZh.oracle : poolsEn.oracle);
  const tasks = Array.from({ length: 3 }, () => pool[Math.floor(rnd() * pool.length)]);
  const uniqTasks = Array.from(new Set(tasks)).slice(0, 3);

  const luckyNumber = 1 + Math.floor(rnd() * 9);
  const luckyColor = palette?.accent || "#c4b5fd";

  const w = weather?.description || (zh ? "未知天气" : "Unknown");
  const temp = typeof weather?.temperatureC === "number" ? `${Math.round(weather.temperatureC)}°C` : zh ? "未知温度" : "unknown temp";

  const title = zh
    ? `${city} · 今日${m === "oracle" ? "神谕" : m === "travel" ? "出行" : m === "focus" ? "专注" : m === "calm" ? "安抚" : "卡片"}`
    : `${city} · ${m === "oracle" ? "Oracle" : m === "travel" ? "Travel" : m === "focus" ? "Focus" : m === "calm" ? "Calm" : "Card"}`;

  const shareLine = zh
    ? `我在 ${city}（${w}，${temp}）用边缘节点抽到一条“今日神谕”：把今天过小一点、也亮一点。`
    : `In ${city} (${w}, ${temp}) my Edge Oracle says: make today smaller—and brighter.`;

  return { date, title, tasks: uniqTasks, luckyColor, luckyNumber, shareLine, seed };
}

function makeStats({ lang, location, weather, mode }) {
  const city = location?.city || (isZhLang(lang) ? "本地" : "local");
  const date = localDateKey(weather);
  const seed = `${date}|${normalizeMode(mode)}|${city}`;
  const rnd = mulberry32(hash32(seed));
  return {
    todayGlobal: 6800 + Math.floor(rnd() * 5200),
    todayCity: 180 + Math.floor(rnd() * 1200)
  };
}

function buildSystemPrompt(lang) {
  if (isZhLang(lang)) {
    return [
      "你是一位同时擅长“创意写作”和“实用建议”的边缘应用文案作者。",
      "你必须结合：用户所在城市/国家、实时天气、以及模式（今日神谕/旅行/专注/安抚/社交卡片）。",
      "输出必须简洁、有画面感、并且可执行。",
      "输出格式：",
      "1) 标题（≤16字）",
      "2) 一句话总结（≤20字）",
      "3) 3–6 条建议（每条≤24字，尽量可立刻去做）",
      "4) 最后一行给出可分享文案，以“分享：”开头（≤28字）",
      "不要输出代码块，不要输出长篇解释。"
    ].join("\n");
  }

  return [
    "You are a creative writer + practical advisor for an edge app.",
    "Always reflect the city/country, live weather, and the selected mode.",
    "Output format:",
    "1) Title (<= 12 words)",
    "2) One-sentence summary (<= 18 words)",
    "3) 3–6 actionable tips (<= 18 words each)",
    "4) Last line is a share line starting with 'Share:' (<= 20 words)",
    "No code blocks."
  ].join("\n");
}

function buildUserPrompt({ prompt, mode, location, weather, lang }) {
  const where = `${location.city ?? (isZhLang(lang) ? "未知城市" : "Unknown city")}, ${location.country ?? (isZhLang(lang) ? "未知国家" : "Unknown country")}`;
  const temp = weather.temperatureC == null ? (isZhLang(lang) ? "未知温度" : "unknown temp") : `${Math.round(weather.temperatureC)}°C`;
  const m = normalizeMode(mode);
  const modeLabelZh = { oracle: "今日神谕", travel: "旅行助手", focus: "专注清单", calm: "情绪安抚", card: "社交卡片" }[m];
  const modeLabelEn = { oracle: "Daily oracle", travel: "Travel helper", focus: "Focus checklist", calm: "Calm & care", card: "Social card" }[m];

  if (isZhLang(lang)) {
    return [
      `模式：${modeLabelZh}`,
      `地点：${where}`,
      `天气：${weather.description}，${temp}`,
      `用户提示：${prompt}`,
      "请给出可执行、可传播的内容。"
    ].join("\n");
  }

  return [
    `Mode: ${modeLabelEn}`,
    `Location: ${where}`,
    `Weather: ${weather.description}, ${temp}`,
    `User prompt: ${prompt}`,
    "Make it actionable and shareable."
  ].join("\n");
}

function mockGenerate({ prompt, mode, location, weather, lang, daily }) {
  const zh = isZhLang(lang);
  const m = normalizeMode(mode);
  const city = location.city ?? (zh ? "你的城市" : "your city");
  const country = location.country ?? (zh ? "你的国家" : "your country");
  const temp = weather.temperatureC == null ? (zh ? "未知温度" : "unknown") : `${Math.round(weather.temperatureC)}°C`;
  const w = weather.description || (zh ? "未知天气" : "Unknown");

  const shareLine = daily?.shareLine || (zh ? `来自 ${city} 的边缘神谕：把今天过小一点、也亮一点。` : `Edge Oracle from ${city}: make today smaller—and brighter.`);
  const tasks = Array.isArray(daily?.tasks) ? daily.tasks : [];

  if (zh) {
    const title =
      m === "travel"
        ? `《${city} 今日轻旅行》`
        : m === "focus"
          ? `《${city} 25 分钟专注》`
          : m === "calm"
            ? `《${city} 温柔安抚》`
            : m === "card"
              ? `《${city} 天气卡片》`
              : `《${city} 今日边缘神谕》`;

    const head = [
      title,
      `地点：${city}，${country}`,
      `天气：${w}，${temp}`,
      daily?.luckyColor ? `幸运色：${daily.luckyColor} · 幸运数字：${daily.luckyNumber ?? 7}` : null,
      ""
    ].filter(Boolean);

    const body =
      m === "travel"
        ? ["一句话：把目的地定在 2km 内。", "", "建议：", "- 走路去一个没去过的街区。", "- 带一件“可加可减”的外套。", "- 记录 3 个路牌/店名。"]
        : m === "focus"
          ? ["一句话：把注意力交给 25 分钟。", "", "建议：", "- 桌面清空 2 分钟。", "- 只做一件事，做到“可交付”。", "- 结束后写下下一步。"]
          : m === "calm"
            ? ["一句话：温柔一点，也能前进。", "", "建议：", "- 做 4-7-8 呼吸 3 轮。", "- 肩膀放松，伸展 20 秒。", "- 写一句允许自己的话。"]
            : m === "card"
              ? ["一句话：把这张卡发给你在乎的人。", "", "卡片：", `- 标题：${city} 的 ${w}`, "- 暖心：愿你在今天的风里也稳稳发光。", "- 祝福：平安喜乐。"]
              : ["一句话：让今天更小、更亮。", "", "神谕：", "- 只做三件事。", "- 出门 10 分钟看天空。", "- 给自己留一个备选方案。"];

    const taskLines = tasks.length ? ["", "今日小任务：", ...tasks.map((x) => `- ${x}`)] : [];

    return [...head, ...body, ...taskLines, "", `分享：${shareLine}`, "", `用户提示：${prompt}`].join("\n");
  }

  const title =
    m === "travel"
      ? `A micro‑trip for ${city}`
      : m === "focus"
        ? `25 minutes of focus in ${city}`
        : m === "calm"
          ? `A calm reset for ${city}`
          : m === "card"
            ? `A weather card from ${city}`
            : `Edge Oracle for ${city}`;

  const body =
    m === "travel"
      ? ["- Pick a spot within 2km and walk there.", "- Bring one layer.", "- Note 3 street/shop names."]
      : m === "focus"
        ? ["- Clear your desk for 2 minutes.", "- Start a 25‑minute timer.", "- Write the next step afterwards."]
        : m === "calm"
          ? ["- Do 3 rounds of 4‑7‑8 breathing.", "- Drop your shoulders for 20 seconds.", "- Say one allowing sentence."]
          : m === "card"
            ? [`- Title: ${city} · ${w}`, "- Warm note: you’ve got this today.", "- Blessing: steady and bright."]
            : ["- Make today smaller: only 3 priorities.", "- Make it brighter: go outside for 10 minutes.", "- Keep one backup plan."];

  const taskLines = tasks.length ? ["", "Today’s quests:", ...tasks.map((x) => `- ${x}`)] : [];

  return [
    title,
    `Location: ${city}, ${country}`,
    `Weather: ${w}, ${temp}`,
    "",
    ...body,
    ...taskLines,
    "",
    `Share: ${shareLine}`,
    "",
    `User prompt: ${prompt}`
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

async function cacheKeyFor({ prompt, lang, mode, location }) {
  const buf = new TextEncoder().encode(`${normalizeLang(lang)}|${normalizeMode(mode)}|${location}|${prompt}`);
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
  let lang = normalizeLang((url.searchParams.get("lang") || "zh").trim() || "zh");
  let mode = normalizeMode((url.searchParams.get("mode") || "oracle").trim() || "oracle");

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.prompt === "string") prompt = body.prompt.trim();
    if (typeof body?.lang === "string") lang = normalizeLang(body.lang.trim() || lang);
    if (typeof body?.mode === "string") mode = normalizeMode(body.mode.trim() || mode);
  }

  if (!prompt) prompt = defaultPromptFor(mode, lang);

  const started = nowMs();
  const edge = getEdgeInfo(request.headers);

  const geoStart = nowMs();
  const rawLocation = await detectLocation(request);
  const location = { ...rawLocation, ip: null };
  const geoMs = Math.round(nowMs() - geoStart);

  const locLabel = `${location.city || "unknown"}-${location.country || "unknown"}-${(location.latitude || 0).toFixed(2)}-${(location.longitude || 0).toFixed(2)}`;
  const key = await cacheKeyFor({ prompt, lang, mode, location: locLabel });

  const cached = await edgeCacheGet(key);
  if (cached.hit && cached.value) {
    const base = cached.value;
    const palette = base?.visual?.palette || pickPalette({ mode, weatherCode: base?.weather?.weatherCode, isDay: base?.weather?.isDay });
    const daily = base?.daily || makeDaily({ mode, lang, location: base?.location || location, weather: base?.weather || {}, palette });
    const visualSeed = `${daily.seed || localDateKey(base?.weather)}|${base?.prompt || prompt}`;
    const visual = base?.visual?.svg ? base.visual : { seed: visualSeed, palette, svg: makeSigilSvg(visualSeed, palette) };
    const stats = base?.stats || makeStats({ lang, location: base?.location || location, weather: base?.weather || {}, mode });
    const enriched = { ...base, lang, mode, daily, visual, stats };

    const shareId = await saveShare(enriched, DEFAULT_TTL_MS);
    const views = await getViewCount(shareId);
    const d = encodeShareDataForUrl({ ...enriched, share: { id: shareId } });
    const shareUrl = d.length <= 6000 ? buildShareUrl(shareId, d) : buildShareUrl(shareId, null);
    return json({
      ...enriched,
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
      ? await getWeather(location.latitude, location.longitude, lang)
      : { temperatureC: null, weatherCode: null, description: describeWeather(null, lang), timezone: null, localTime: null, isDay: null };
  const weatherMs = Math.round(nowMs() - weatherStart);

  const palette = pickPalette({ mode, weatherCode: weather.weatherCode, isDay: weather.isDay });
  const daily = makeDaily({ mode, lang, location, weather, palette });
  const visualSeed = `${daily.seed}|${prompt}`;
  const visual = { seed: visualSeed, palette, svg: makeSigilSvg(visualSeed, palette) };
  const stats = makeStats({ lang, location, weather, mode });

  const aiStart = nowMs();
  const apiKey = envGet(env, "DASHSCOPE_API_KEY");
  const model = envGet(env, "AI_TEXT_MODEL") || "qwen-max";

  let contentText;
  let contentMode = "mock";
  let usedModel = "mock-template";

  if (apiKey) {
    try {
      const sys = buildSystemPrompt(lang);
      const user = buildUserPrompt({ prompt, mode, location, weather, lang });
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
      contentMode = "qwen";
    } catch {
      contentText = mockGenerate({ prompt, mode, location, weather, lang, daily });
    }
  } else {
    contentText = mockGenerate({ prompt, mode, location, weather, lang, daily });
  }

  const aiMs = Math.round(nowMs() - aiStart);

  const result = {
    prompt,
    lang,
    mode,
    location,
    weather,
    edge,
    cache: { hit: false, ttlMs: DEFAULT_TTL_MS, key },
    content: { text: contentText, model: usedModel, mode: contentMode },
    share: { id: null, url: null, views: null },
    timing: {
      totalMs: Math.round(nowMs() - started),
      geoMs,
      weatherMs,
      aiMs,
      originSimulatedMs: simulateOriginMs(Math.round(nowMs() - started), false)
    },
    visual,
    daily,
    stats,
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





