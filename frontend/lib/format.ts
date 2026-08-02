// Money formatting for engine-produced Decimal strings.
//
// The engine serializes money as an exact Decimal string (faraid_web/serialize.py:_money
// → str(Decimal.quantize("0.01"))), and validate.py permits up to 20 digits — past the ~15
// significant digits a JS number holds. So the primary figure is grouped by STRING
// manipulation and never round-trips through Number: what is displayed is exactly what the
// engine computed. Number() is used only for the compact form, which is explicitly
// approximate and labelled with "≈".

import type { Lang } from "@/lib/i18n";

/** Thousands / decimal separators per locale. Indonesian uses "." and ",". */
function separators(lang: Lang): { group: string; decimal: string } {
  return lang === "id" ? { group: ".", decimal: "," } : { group: ",", decimal: "." };
}

/** Insert a group separator every three digits, right to left. Exact — string only. */
function groupDigits(digits: string, group: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

interface Parsed {
  negative: boolean;
  int: string; // digits only, no sign, no separators
  frac: string; // digits only, may be ""
}

/** Split an engine Decimal string ("-511111111.11") into exact parts. */
function parseDecimal(raw: string): Parsed | null {
  const s = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [int, frac = ""] = (negative ? s.slice(1) : s).split(".");
  return { negative, int: int.replace(/^0+(?=\d)/, ""), frac };
}

export type CentsMode = "auto" | "always" | "never";

/**
 * Decide whether cents are worth showing. On a multi-billion estate the two decimals are
 * noise; on a small estate they are the answer. "auto" shows them below 4 integer digits.
 */
function wantsCents(int: string, mode: CentsMode): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return int.length < 4;
}

export interface MoneyOptions {
  cents?: CentsMode;
  /** Omit the "Rp " prefix (for use inside an input that already shows one). */
  bare?: boolean;
}

/**
 * Format an engine money string for display: "511111111.11" → "Rp 511.111.111" (id).
 * Returns "" for null/undefined so callers can render nothing without a guard.
 */
export function formatMoney(
  raw: string | null | undefined,
  lang: Lang,
  opts: MoneyOptions = {}
): string {
  if (raw == null || raw === "") return "";
  const parsed = parseDecimal(raw);
  if (!parsed) return raw; // never invent a number: show what the engine sent
  const { group, decimal } = separators(lang);

  let out = groupDigits(parsed.int, group);
  if (wantsCents(parsed.int, opts.cents ?? "auto")) {
    out += decimal + (parsed.frac + "00").slice(0, 2);
  }
  if (parsed.negative) out = "-" + out;
  return opts.bare ? out : `Rp ${out}`;
}

// Indonesian magnitude words. Intl's compact notation for id-ID rounds to 3 significant
// digits ("512 jt"), which loses the distinction the eye is scanning for, so the ID scale
// is written out to keep one decimal.
const ID_SCALE: { limit: number; suffix: string }[] = [
  { limit: 1e12, suffix: "T" },
  { limit: 1e9, suffix: "M" },
  { limit: 1e6, suffix: "jt" },
  { limit: 1e3, suffix: "rb" },
];

/**
 * Approximate short form for scanning: "≈ Rp 511,1 jt" / "≈ Rp 511.1M". Never the primary
 * figure — the caller is responsible for keeping the exact value visible alongside it.
 */
export function formatCompact(raw: string | null | undefined, lang: Lang): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs < 1000) return "";  // no shorthand worth showing

  if (lang === "en") {
    return `Rp ${new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)}`;
  }

  const step = ID_SCALE.find((s) => abs >= s.limit);
  if (!step) return "";
  const scaled = n / step.limit;
  // Two decimals below 10, one above: "2,73 M" and "511,1 jt" both read cleanly, and at
  // this scale the first decimal is still worth ~100 million rupiah — never drop it.
  const digits = Math.abs(scaled) < 10 ? 2 : 1;
  const text = scaled.toFixed(digits).replace(".", ",").replace(/,?0+$/, "");
  return `Rp ${text} ${step.suffix}`;
}

/** Locale-grouped plain integer (heir counts, base numbers). */
export function formatCount(n: number, lang: Lang): string {
  return groupDigits(String(Math.trunc(Math.abs(n))), separators(lang).group);
}

/* ------------------------------------------------------------------ Input side */

/**
 * Strip a typed money string down to what the engine accepts: digits and at most one
 * decimal point. Both locale decimal separators are accepted so an Indonesian user typing
 * "1.500,50" and an English user typing "1,500.50" both land on "1500.50".
 */
export function parseMoneyInput(text: string, lang: Lang): string {
  const { decimal } = separators(lang);
  let out = "";
  let seenDecimal = false;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if ((ch === decimal || ch === "." || ch === ",") && !seenDecimal) {
      // A separator is only a decimal point if it is the locale's decimal mark; the
      // grouping mark is dropped. Ambiguity is resolved in favour of the locale.
      if (ch === decimal) {
        seenDecimal = true;
        out += ".";
      }
    }
  }
  return out;
}

/**
 * Render a stored raw value back into the input, grouped as the user types. A trailing
 * decimal point is preserved so typing "1500." doesn't fight the cursor.
 */
export function formatMoneyInput(raw: string, lang: Lang): string {
  if (!raw) return "";
  const { group, decimal } = separators(lang);
  const [int, frac] = raw.split(".");
  const grouped = groupDigits(int || "0", group);
  if (!raw.includes(".")) return grouped;
  return grouped + decimal + (frac ?? "");
}

/* ------------------------------------------------------- Exact cent arithmetic */

/**
 * Convert an engine money string to integer cents exactly, via BigInt. Used to reconcile
 * the sum of the awarded amounts against the divisible estate without float error.
 * Returns null if the string is not a plain decimal.
 */
export function toCents(raw: string | null | undefined): bigint | null {
  if (raw == null || raw === "") return null;
  const parsed = parseDecimal(raw);
  if (!parsed) return null;
  const frac = (parsed.frac + "00").slice(0, 2);
  const value = BigInt(parsed.int + frac);
  return parsed.negative ? -value : value;
}

/** Render integer cents back to a money string ("1" → "Rp 0,01"). */
export function centsToMoney(cents: bigint, lang: Lang): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const raw = `${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
  return formatMoney((negative ? "-" : "") + raw, lang, { cents: "always" });
}
