const SUPPORTED = ["en", "zh", "ja", "ko", "es", "fr"] as const;
export type SupportedLang = (typeof SUPPORTED)[number];

export function pickBestLang(acceptLanguageHeader: string): SupportedLang {
  const raw = acceptLanguageHeader.split(",").map((p) => p.trim().toLowerCase());
  for (const part of raw) {
    const base = part.split(";")[0]?.split("-")[0];
    if (!base) continue;
    if (SUPPORTED.includes(base as SupportedLang)) return base as SupportedLang;
    if (base === "zh") return "zh";
  }
  return "en";
}

export const SUPPORTED_LANGS = SUPPORTED;

