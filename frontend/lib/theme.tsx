"use client";

// Theme switcher: System / Light / Dark. Persists to localStorage and stamps
// `data-theme` on <html> (which overrides the OS media query — see globals.css). A blocking
// inline script (in layout) applies the saved theme before first paint to avoid a flash.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Icon } from "@/components/ui";
import { useI18n } from "./i18n";

export type Theme = "system" | "light" | "dark";
const KEY = "fv-theme";

// Runs before hydration to prevent a flash of the wrong theme.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as Theme | null;
    if (saved === "light" || saved === "dark") setThemeState(saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    apply(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {}
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const ORDER: Theme[] = ["system", "light", "dark"];
const ICON: Record<Theme, string> = { system: "monitor", light: "sun", dark: "moon" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const label: Record<Theme, string> = {
    system: t("theme_system"),
    light: t("theme_light"),
    dark: t("theme_dark"),
  };
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(next)}
      title={`${t("theme")}: ${label[theme]}`}
      aria-label={`${t("theme")}: ${label[theme]}`}
    >
      <Icon name={ICON[theme]} size={16} />
      <span className="tt-label">{label[theme]}</span>
    </button>
  );
}
