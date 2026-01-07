export type GeoSource = "headers" | "ip_api" | "geolocation" | "share" | "unknown";

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
  timezone?: string | null;
  localTime?: string | null;
  isDay?: boolean | null;
};

export type GenerateMode = "oracle" | "travel" | "calm" | "focus" | "card";
export type Mood = "auto" | "happy" | "anxious";
export type WeatherOverride = "auto" | "clear" | "rain";

export type VisualInfo = {
  seed: string;
  svg: string;
  palette: {
    bg: string;
    fg: string;
    accent: string;
  };
};

export type DailyInfo = {
  date: string;
  title: string;
  tasks: string[];
  luckyColor: string;
  luckyNumber: number;
  shareLine: string;
};

export type StatsInfo = {
  todayGlobal: number;
  todayCity: number;
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
  mode?: GenerateMode;
  mood?: Mood;
  weatherOverride?: WeatherOverride;
  location: LocationInfo;
  weather: WeatherInfo;
  edge: EdgeInfo;
  cache: CacheInfo;
  content: ContentInfo;
  share: ShareInfo;
  timing: TimingInfo;
  visual?: VisualInfo | null;
  daily?: DailyInfo | null;
  stats?: StatsInfo | null;
  generatedAt: string;
};
