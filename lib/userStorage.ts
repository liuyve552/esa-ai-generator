export type DailyTaskEnvelope = {
  v: 1;
  updatedAt: number;
  state: Record<string, boolean>;
};

export type OracleHistoryItem = {
  id: string;
  url: string;
  at: number;
  date: string;
  mode: string;
  place: string;
  weather: string;
  shareLine?: string | null;
};

export type OracleHistoryEnvelope = {
  v: 1;
  updatedAt: number;
  items: OracleHistoryItem[];
};

const UID_KEY = "esa:uid:v1";
const HISTORY_LOCAL_KEY = "esa:history:v1";

function base64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function getOrCreateAnonId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const existing = window.localStorage.getItem(UID_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;

    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }

    const next = base64Url(bytes);
    window.localStorage.setItem(UID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function readLocalJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeLocalJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeLocal(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

function isRecordBoolean(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== "object") return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "boolean") return false;
  }
  return true;
}

export function normalizeDailyTaskEnvelope(raw: unknown): DailyTaskEnvelope | null {
  if (!raw) return null;
  if (typeof raw !== "object") return null;
  const any = raw as Record<string, unknown>;

  if (any.v === 1 && typeof any.updatedAt === "number" && isRecordBoolean(any.state)) {
    return { v: 1, updatedAt: any.updatedAt, state: any.state };
  }

  // Legacy: state stored as { [task]: boolean }
  if (isRecordBoolean(any)) {
    return { v: 1, updatedAt: 0, state: any };
  }

  return null;
}

export function normalizeHistoryEnvelope(raw: unknown): OracleHistoryEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const any = raw as Record<string, unknown>;
  if (any.v !== 1 || typeof any.updatedAt !== "number" || !Array.isArray(any.items)) return null;

  const items: OracleHistoryItem[] = [];
  for (const it of any.items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.url !== "string") continue;
    if (typeof o.at !== "number") continue;
    if (typeof o.date !== "string" || typeof o.mode !== "string") continue;
    if (typeof o.place !== "string" || typeof o.weather !== "string") continue;
    items.push({
      id: o.id,
      url: o.url,
      at: o.at,
      date: o.date,
      mode: o.mode,
      place: o.place,
      weather: o.weather,
      shareLine: typeof o.shareLine === "string" ? o.shareLine : null
    });
  }

  return { v: 1, updatedAt: any.updatedAt, items };
}

export async function fetchUserDailyEnvelope(opts: {
  uid: string;
  date: string;
  mode: string;
  city: string;
}): Promise<DailyTaskEnvelope | null> {
  try {
    const url = new URL("/api/user/daily", globalThis.location.origin);
    url.searchParams.set("date", opts.date);
    url.searchParams.set("mode", opts.mode);
    url.searchParams.set("city", opts.city);
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "x-esa-uid": opts.uid }
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { envelope?: unknown };
    return normalizeDailyTaskEnvelope(json.envelope ?? null);
  } catch {
    return null;
  }
}

export async function putUserDailyEnvelope(opts: {
  uid: string;
  date: string;
  mode: string;
  city: string;
  envelope: DailyTaskEnvelope;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/user/daily", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-esa-uid": opts.uid },
      body: JSON.stringify({
        date: opts.date,
        mode: opts.mode,
        city: opts.city,
        envelope: opts.envelope
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function readLocalHistory(): OracleHistoryEnvelope | null {
  return normalizeHistoryEnvelope(readLocalJson(HISTORY_LOCAL_KEY));
}

export function writeLocalHistory(next: OracleHistoryEnvelope): void {
  writeLocalJson(HISTORY_LOCAL_KEY, next);
}

export async function fetchUserHistory(opts: { uid: string }): Promise<OracleHistoryEnvelope | null> {
  try {
    const res = await fetch("/api/user/history", { method: "GET", cache: "no-store", headers: { "x-esa-uid": opts.uid } });
    if (!res.ok) return null;
    const json = (await res.json()) as { history?: unknown };
    return normalizeHistoryEnvelope(json.history ?? null);
  } catch {
    return null;
  }
}

export async function appendUserHistory(opts: { uid: string; item: OracleHistoryItem }): Promise<boolean> {
  try {
    const res = await fetch("/api/user/history", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-esa-uid": opts.uid },
      body: JSON.stringify({ item: opts.item })
    });
    return res.ok;
  } catch {
    return false;
  }
}
