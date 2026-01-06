import { edgeCacheGet, edgeCachePut } from "@/lib/edge/cache";
import type { WeatherInfo } from "@/lib/edge/types";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

function normalizeLangForWeather(lang: string) {
  const v = (lang || "en").toLowerCase();
  return v.startsWith("zh") ? "zh" : "en";
}

export async function getWeather(latitude: number, longitude: number, lang: string): Promise<WeatherInfo> {
  const langKey = normalizeLangForWeather(lang);
  const latKey = latitude.toFixed(2);
  const lonKey = longitude.toFixed(2);
  const cacheKey = `https://edge-cache.local/weather/${langKey}/${latKey},${lonKey}`;

  const cached = await edgeCacheGet<WeatherInfo>(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { cache: "force-cache", next: { revalidate: 600 } });
  const json = (await res.json().catch(() => null)) as OpenMeteoResponse | null;
  const temperatureC = typeof json?.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
  const weatherCode = typeof json?.current?.weather_code === "number" ? json.current.weather_code : null;

  const info: WeatherInfo = {
    temperatureC,
    weatherCode,
    description: describeWeather(weatherCode, langKey)
  };

  await edgeCachePut(cacheKey, info, 10 * 60 * 1000);
  return info;
}

export function describeWeather(code: number | null, lang: string = "en"): string {
  const langKey = normalizeLangForWeather(lang);

  if (langKey === "zh") {
    if (code == null) return "未知";
    if (code === 0) return "晴朗";
    if (code === 1) return "大部晴朗";
    if (code === 2) return "局部多云";
    if (code === 3) return "阴天";
    if (code === 45 || code === 48) return "有雾";
    if (code === 51 || code === 53 || code === 55) return "毛毛雨";
    if (code === 56 || code === 57) return "冻毛毛雨";
    if (code === 61 || code === 63 || code === 65) return "雨";
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
