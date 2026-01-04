import { edgeCacheGet, edgeCachePut } from "@/lib/edge/cache";
import type { WeatherInfo } from "@/lib/edge/types";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

export async function getWeather(latitude: number, longitude: number): Promise<WeatherInfo> {
  const latKey = latitude.toFixed(2);
  const lonKey = longitude.toFixed(2);
  const cacheKey = `https://edge-cache.local/weather/${latKey},${lonKey}`;

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
    description: describeWeather(weatherCode)
  };

  await edgeCachePut(cacheKey, info, 10 * 60 * 1000);
  return info;
}

export function describeWeather(code: number | null): string {
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
