"use client";

import { ReactNode, useId, useState } from "react";
import { FractionValue, Share } from "@/lib/api";
import { formatMoneyInput, parseMoneyInput } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

/* ------------------------------------------------------------------ Icons */
// Inline, stroke-based icons (self-contained — no icon package / network needed).

const PATHS: Record<string, ReactNode> = {
  scale: <><path d="M12 3v18" /><path d="M8 21h8" /><path d="M3 7h18" /><path d="M6.5 4.5 3 11h7z" /><path d="M17.5 4.5 21 11h-7z" /><path d="M12 3.2 6.5 4.5m5.5-1.3 5.5 1.3" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
  baby: <><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5S14.5 8 13 8" /></>,
  crown: <path d="M3 17h18l-1.5-9-4.5 4-3-6-3 6-4.5-4z" />,
  branch: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M8.5 6.6C13 7 15.5 8 15.5 11v0" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" /></>,
  alert: <><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></>,
  table: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></>,
  sitemap: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-2h12v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  minus: <path d="M5 12h14" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  sparkles: <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" />,
  scroll: <><path d="M8 3h9a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8" /><path d="M3 5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v13a3 3 0 0 0 3 3" /><path d="M11 7h5M11 11h5" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M12 8S10 3 7.5 4.5 12 8 12 8zM12 8s2-5 4.5-3.5S12 8 12 8z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  shield: <path d="M12 3l7.5 3v5.6c0 4.3-3 8.2-7.5 9.4-4.5-1.2-7.5-5.1-7.5-9.4V6z" />,
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

/* --------------------------------------------------------------- Fraction */
export function Fraction({ value, className = "" }: { value: FractionValue; className?: string }) {
  if (value.denominator === 1) return <span className={`frac ${className}`}>{value.numerator}</span>;
  return (
    <span className={`frac ${className}`}>
      <span className="n">{value.numerator}</span>
      <span className="s">/</span>
      <span className="d">{value.denominator}</span>
    </span>
  );
}

/* ---------------------------------------------------------- Segmented ctrl */
export function Segmented<T extends string>({
  options, value, onChange, block, ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T; onChange: (v: T) => void; block?: boolean; ariaLabel?: string;
}) {
  return (
    <div className={`segmented ${block ? "block" : ""}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- Number stepper */
export function NumberStepper({
  label, value, onChange, max,
}: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  const { t } = useI18n();
  const v = value ?? 0;
  const id = useId();
  return (
    <div className="stepper-wrap">
      {/* A real <label>, not a styled span. The AX tree reported all ten of these fields
          as `spinbutton *** UNNAMED ***` — a screen reader announced "spin button, 2"
          with no way to tell sons from paternal sisters. */}
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="stepper">
        {/* Named by what they do and to WHICH field. "minus"/"plus" named the glyph, and
            with ten steppers on the form a screen reader read out twenty identical
            buttons. */}
        <button type="button" aria-label={`${t("stepper_less")} ${label}`}
          disabled={v <= 0} onClick={() => onChange(Math.max(0, v - 1))}>
          <Icon name="minus" size={16} />
        </button>
        <input id={id} type="number" min={0} max={max} value={v}
          onChange={(e) => {
            let n = parseInt(e.target.value || "0", 10);
            if (Number.isNaN(n) || n < 0) n = 0;
            if (max != null) n = Math.min(max, n);
            onChange(n);
          }} />
        <button type="button" aria-label={`${t("stepper_more")} ${label}`}
          disabled={max != null && v >= max} onClick={() => onChange(max != null ? Math.min(max, v + 1) : v + 1)}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Switch row */
export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`switch-row ${checked ? "on" : ""}`}>
      <span className="switch-label">{label}</span>
      <span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></span>
    </label>
  );
}

/* --------------------------------------------------------------- Money input */
/**
 * Currency field for estate amounts. Groups digits as you type and shows a "Rp" adornment,
 * but stores the RAW unformatted string — that is what CalculationRequest.estate expects,
 * and the engine parses it as a Decimal.
 */
export function MoneyInput({
  label, value, onChange, placeholder = "0", hint,
}: {
  label: string; value: string; onChange: (raw: string) => void;
  placeholder?: string;
  /** Shown above the field. These amounts mean different things and are not interchangeable. */
  hint?: string;
}) {
  const { lang, t } = useI18n();
  const id = useId();
  const hintId = `${id}-hint`;
  // Collapsed by default: five fields of permanent help turned this section into a wall of
  // grey text and knocked the inputs out of alignment. The contextual warnings below stay
  // visible regardless — those, not this prose, are what actually catch a wrong entry.
  const [showHint, setShowHint] = useState(false);
  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>{label}</label>
        {hint && (
          <button
            type="button"
            className={`field-info ${showHint ? "on" : ""}`}
            onClick={() => setShowHint((v) => !v)}
            aria-expanded={showHint}
            aria-controls={hintId}
            aria-label={`${t("what_is_this")} — ${label}`}
            title={hint}
          >
            <Icon name="info" size={13} />
          </button>
        )}
      </div>
      {hint && showHint && <span className="field-hint" id={hintId}>{hint}</span>}
      <div className="money-input">
        <span className="money-prefix" aria-hidden>Rp</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
          value={formatMoneyInput(value, lang)}
          placeholder={placeholder}
          onChange={(e) => onChange(parseMoneyInput(e.target.value, lang))}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Heir section */
/**
 * Collapsible form section. Collapsed sections still report what they hold, so the form can
 * be scanned in one screen instead of scrolled — which is the point: the Calculate button
 * used to sit ~29 controls below the fold.
 */
export function HeirSection({
  icon, title, summary, count, open, onToggle, children,
}: {
  icon: string;
  title: string;
  summary: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`heir-section ${open ? "open" : ""} ${count > 0 ? "filled" : ""}`}>
      <button
        type="button"
        className="heir-section-head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
      >
        <span className="hs-ico"><Icon name={icon} size={16} /></span>
        <span className="hs-title">{title}</span>
        {!open && summary && <span className="hs-summary">{summary}</span>}
        {count > 0 && <span className="hs-count">{count}</span>}
        <span className="hs-chevron"><Icon name="chevron" size={16} /></span>
      </button>
      {open && <div className="heir-section-body" id={id}>{children}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- Category chip */
export function CategoryChip({ category, label }: { category: string; label: string }) {
  return <span className={`chip chip-${category}`}>{label}</span>;
}

/* --------------------------------------- Proportion bar + harmonized colors */
// Defined as CSS custom properties (globals.css) rather than literals so they can be
// re-tuned for dark mode along with every other surface colour.
export const HEIR_COLOR_COUNT = 10;

export function colorFor(index: number): string {
  return `var(--heir-${(index % HEIR_COLOR_COUNT) + 1})`;
}

export function ProportionBar({ shares }: { shares: Share[] }) {
  const total = shares.reduce((a, s) => a + s.share.float, 0) || 1;
  return (
    <div className="proportion" role="img" aria-label="Share proportions">
      {shares.map((s, i) => (
        <div key={i} className="seg" style={{ width: `${(s.share.float / total) * 100}%`, background: colorFor(i) }}
          title={`${s.label} — ${s.share.text} (${Math.round((s.share.float / total) * 100)}%)`} />
      ))}
    </div>
  );
}
