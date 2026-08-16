"use client";

// Theme switcher: System / Light / Dark. Persists to localStorage and stamps
// `data-theme` on <html> (which overrides the OS media query — see globals.css). A blocking
// inline script (in layout) applies the saved theme before first paint to avoid a flash.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Icon } from "@/components/ui";
import { useI18n } from "./i18n";

export type Theme = "system" | "light" | "dark";
const KEY = "fv-theme";

/**
 * Browser/OS chrome color (installed-window titlebar, mobile status bar). Must match
 * --bg / --dark-bg in globals.css exactly — these are the two ends of the SAME palette
 * decision, just expressed as a <meta> tag instead of a CSS custom property, because the
 * browser reads its own chrome color before any stylesheet is involved.
 *
 * Previously a static <meta name="theme-color" media="..."> pair in layout.tsx's
 * `viewport` export, which only ever looked at prefers-color-scheme — a user who chose
 * Light while their OS was set to dark got dark browser chrome around a light page
 * (DESIGN.md §3). Managed here instead, alongside the `data-theme` attribute it has to
 * agree with, so both trigger from the same resolved theme rather than two independent
 * sources that can disagree.
 */
const THEME_COLOR = { light: "#f4f1e9", dark: "#121310" } as const;

// Runs before hydration to prevent a flash of the wrong theme OR the wrong chrome color.
export const THEME_INIT_SCRIPT = `(function(){try{
  var LIGHT='${THEME_COLOR.light}',DARK='${THEME_COLOR.dark}';
  var t=localStorage.getItem('${KEY}');
  if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}
  var resolved=(t==='dark'||t==='light')?t:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  var meta=document.querySelector('meta[name="theme-color"]');
  if(!meta){meta=document.createElement('meta');meta.setAttribute('name','theme-color');document.head.appendChild(meta);}
  meta.setAttribute('content',resolved==='dark'?DARK:LIGHT);
}catch(e){}})();`;

function resolveThemeColor(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setThemeColorMeta(theme: Theme) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLOR[resolveThemeColor(theme)]);
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  setThemeColorMeta(theme);
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

  // While following the OS, the chrome color has to follow it live too — otherwise a
  // user on "System" who flips their OS theme mid-session keeps the old browser chrome
  // until their next toggle, the same staleness DESIGN.md flagged for the explicit case.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setThemeColorMeta("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

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
      aria-label={`${t("theme")}: ${label[theme]}`}
    >
      <Icon name={ICON[theme]} size={16} />
      <span className="tt-label">{label[theme]}</span>
    </button>
  );
}
