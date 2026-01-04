import type { GenerateResponse } from "@/lib/edge/types";
import { detectLocation } from "@/lib/edge/geo";
import { getWeather } from "@/lib/edge/weather";
import { edgeCacheGet, edgeCachePut } from "@/lib/edge/cache";
import { generateWithQwen } from "@/lib/edge/qwen";
import { getViewCount, saveShare } from "@/lib/edge/share";

function getEdgeInfo(headers: Headers) {
  const vercelId = headers.get("x-vercel-id");
  const cfRay = headers.get("cf-ray");
  const esa = headers.get("x-esa-edge-location") ?? headers.get("x-esa-region") ?? null;

  if (vercelId) {
    const node = vercelId.split("::")[0] ?? vercelId;
    return { provider: "Vercel Edge", node, requestId: vercelId };
  }
  if (cfRay) {
    const parts = cfRay.split("-");
    const colo = parts[1] ?? "Cloudflare";
    return { provider: "Cloudflare Edge", node: colo, requestId: cfRay };
  }
  if (esa) return { provider: "ESA Edge", node: esa, requestId: null };
  return { provider: "Edge", node: "near-user", requestId: null };
}

async function cacheKeyFor({
  prompt,
  lang,
  location
}: {
  prompt: string;
  lang: string;
  location: string;
}) {
  const buf = new TextEncoder().encode(`${lang}|${location}|${prompt}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
  return `https://edge-cache.local/gen/${b64}`;
}

export async function generatePersonalized({
  request,
  prompt,
  lang,
  ttlMs
}: {
  request: Request;
  prompt: string;
  lang: string;
  ttlMs: number;
}): Promise<GenerateResponse> {
  const started = performance.now();
  const edge = getEdgeInfo(request.headers);

  const geoStart = performance.now();
  const location = await detectLocation(request);
  const geoMs = Math.round(performance.now() - geoStart);

  const locLabel = `${location.city ?? "unknown"}-${location.country ?? "unknown"}-${(location.latitude ?? 0).toFixed(
    2
  )}-${(location.longitude ?? 0).toFixed(2)}`;

  const key = await cacheKeyFor({ prompt, lang, location: locLabel });
  const cached = await edgeCacheGet<GenerateResponse>(key);
  if (cached.hit && cached.value) {
    const shareId = await saveShare(cached.value, ttlMs);
    const views = await getViewCount(shareId);
    return {
      ...cached.value,
      cache: { hit: true, ttlMs, key },
      share: { id: shareId, url: `/s/${shareId}`, views },
      timing: {
        ...cached.value.timing,
        totalMs: Math.round(performance.now() - started),
        geoMs
      }
    };
  }

  const weatherStart = performance.now();
  const weather =
    location.latitude != null && location.longitude != null
      ? await getWeather(location.latitude, location.longitude)
      : { temperatureC: null, weatherCode: null, description: "Unknown" };
  const weatherMs = Math.round(performance.now() - weatherStart);

  const aiStart = performance.now();
  const apiKey = process.env.DASHSCOPE_API_KEY ?? "";
  const model = process.env.AI_TEXT_MODEL ?? "qwen-max";

  let contentText: string;
  let mode: "qwen" | "mock" = "mock";
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

  const aiMs = Math.round(performance.now() - aiStart);

  const result: GenerateResponse = {
    prompt,
    lang,
    location,
    weather,
    edge,
    cache: { hit: false, ttlMs, key },
    content: { text: contentText, model: usedModel, mode },
    share: { id: null, url: null, views: null },
    timing: {
      totalMs: Math.round(performance.now() - started),
      geoMs,
      weatherMs,
      aiMs,
      originSimulatedMs: simulateOriginMs()
    },
    generatedAt: new Date().toISOString()
  };

  await edgeCachePut(key, result, ttlMs);

  const shareId = await saveShare(result, ttlMs);
  const views = await getViewCount(shareId);
  const final: GenerateResponse = {
    ...result,
    share: { id: shareId, url: `/s/${shareId}`, views }
  };

  await edgeCachePut(key, final, ttlMs);
  return final;
}

function simulateOriginMs() {
  const base = 260;
  const jitter = Math.floor(Math.random() * 220);
  return base + jitter;
}

function buildSystemPrompt(lang: string) {
  return [
    "You are an award-winning creative writer and practical advisor.",
    "Generate a concise, vivid, useful response tailored to the user.",
    "Always reflect the given location and live weather.",
    "Output must be in the target language:",
    `LANGUAGE=${lang}`,
    "Format: a short title line, then 6-10 bullet points or short paragraphs, then a 1-line closing."
  ].join("\\n");
}

function buildUserPrompt({
  prompt,
  location,
  weather,
  lang
}: {
  prompt: string;
  location: { city: string | null; country: string | null };
  weather: { temperatureC: number | null; description: string };
  lang: string;
}) {
  const where = `${location.city ?? "Unknown city"}, ${location.country ?? "Unknown country"}`;
  const temp = weather.temperatureC == null ? "unknown" : `${Math.round(weather.temperatureC)}C`;
  return [
    `User prompt: ${prompt}`,
    `Context: You are located in ${where}. Weather: ${weather.description}, ${temp}.`,
    `Target language: ${lang}.`,
    "Make it feel local and actionable (places, timing, what to do now)."
  ].join("\\n");
}

function mockGenerate({
  prompt,
  location,
  weather,
  lang
}: {
  prompt: string;
  location: { city: string | null; country: string | null };
  weather: { temperatureC: number | null; description: string };
  lang: string;
}) {
  const city = location.city ?? "your city";
  const country = location.country ?? "your country";
  const temp = weather.temperatureC == null ? "unknown" : `${Math.round(weather.temperatureC)}°C`;

  if (lang.startsWith("zh")) {
    return [
      `《${city} 的即时灵感》`,
      `你在：${city}，${country}`,
      `天气：${weather.description}，${temp}`,
      "",
      "建议：",
      "- 先用 10 分钟“就近漫步”：找一个离你最近的街区/公园，观察 3 个细节（颜色、声音、气味）。",
      "- 如果你要旅行/出行：把行程拆成“1 个主目标 + 2 个备选”，天气变化就切换备选。",
      "- 现在就做一件可执行的小事：根据天气调整衣物/雨具，然后出门买一杯当地常见饮品。",
      "- 写一句“当地化”的记录：今天的 " + city + " 像……（用一个比喻）。",
      "",
      `你的原始提示词：${prompt}`
    ].join("\\n");
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
  ].join("\\n");
}

