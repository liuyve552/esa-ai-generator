export type GeoSource = "headers" | "ip_api" | "unknown";

export type LocationInfo = {
  city: string | null;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  ip: string | null;
  source: GeoSource;
};

export type WeatherInfo = {
  temperatureC: number | null;
  weatherCode: number | null;
  description: string;
};

export type EdgeInfo = {
  provider: string;
  node: string;
  requestId: string | null;
};

export type CacheInfo = {
  hit: boolean;
  ttlMs: number;
  key: string;
};

export type ContentInfo = {
  text: string;
  model: string;
  mode: "qwen" | "mock";
};

export type ShareInfo = {
  id: string | null;
  url: string | null;
  views: number | null;
};

export type TimingInfo = {
  totalMs: number;
  geoMs: number;
  weatherMs: number;
  aiMs: number;
  originSimulatedMs: number;
};

export type GenerateResponse = {
  prompt: string;
  lang: string;
  location: LocationInfo;
  weather: WeatherInfo;
  edge: EdgeInfo;
  cache: CacheInfo;
  content: ContentInfo;
  share: ShareInfo;
  timing: TimingInfo;
  generatedAt: string;
};

