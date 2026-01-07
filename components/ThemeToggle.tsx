"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

export default function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const label = useMemo(() => (theme === "dark" ? t("theme.dark") : t("theme.light")), [t, theme]);

  return (
    <button
      className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 backdrop-blur transition hover:bg-black/10 dark:border-white/15 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
    >
      {label}
    </button>
  );
}
