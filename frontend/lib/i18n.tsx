"use client";

// Frontend i18n (PRD §7: Bahasa Indonesia primary, English secondary).
//
// Derivation TEXT (reasons, labels, categories, step titles, notes, disclaimer) is
// localized server-side and returned already-translated per the `lang` sent with each
// request (single source of truth in the API layer). This module only supplies the
// static UI chrome (headings, buttons, form labels) and the form-time relation/ruleset
// labels shown before a calculation exists.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// The dictionaries live in lib/strings.ts (plain data, no "use client") so server
// components can read the same strings the UI renders. Re-exported here so every
// existing import site is unchanged.
export type { Lang } from "@/lib/strings";
export {
  STRINGS,
  RULESET_LABELS_I18N,
  RULESET_SHORT_I18N,
  RELATION_LABELS_I18N,
} from "@/lib/strings";
import { STRINGS, RULESET_LABELS_I18N, RULESET_SHORT_I18N, RELATION_LABELS_I18N } from "@/lib/strings";
import type { Lang } from "@/lib/strings";

const LANG_KEY = "fv-lang";

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof STRINGS) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  // Read after mount, not in the useState initializer: the page is statically prerendered
  // (next.config.js `output: "export"`), so touching localStorage during render would be a
  // hydration mismatch. Mirrors lib/theme.tsx.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "id" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  // Keep <html lang> honest for screen readers and browser translation prompts.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

  const t = (key: keyof typeof STRINGS) => STRINGS[key]?.[lang] ?? String(key);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function relationLabel(labelId: string, lang: Lang): string {
  return RELATION_LABELS_I18N[lang][labelId] ?? labelId;
}
export function rulesetLabel(ruleset: string, lang: Lang): string {
  return RULESET_LABELS_I18N[lang][ruleset] ?? ruleset;
}
/** Short name where the full one is already on screen; falls back to the full label. */
export function rulesetShort(ruleset: string, lang: Lang): string {
  return RULESET_SHORT_I18N[lang][ruleset] ?? rulesetLabel(ruleset, lang);
}
export function categoryLabel(category: string, t: I18nCtx["t"]): string {
  const map: Record<string, keyof typeof STRINGS> = {
    furud: "cat_furud", asabah: "cat_asabah", radd: "cat_radd",
    dzawil_arham: "cat_dzawil_arham", harta_bersama: "cat_harta_bersama",
  };
  return map[category] ? t(map[category]) : category;
}
