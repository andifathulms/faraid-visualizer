// Shareable calculation state in the query string.
//
// The static build has no server and no stored calculations, so the URL is the only place a
// case can live. Encoding it there makes a calculation something you can send to an ustadz
// or a notaris, and incidentally makes a reload non-destructive.
//
// Everything decoded here is UNTRUSTED — a URL can say anything. Values are clamped to the
// same limits validate.py enforces (MAX_WIVES 4, MAX_COUNT 50) so a hand-edited link
// produces a sane form rather than an engine error. The engine still validates again.

import type { EstateInput, HeirsInput, Mode, Representative, Ruleset } from "@/lib/api";

const MAX_COUNT = 50;
const MAX_WIVES = 4;

const RULESETS: Ruleset[] = ["khi", "syafii", "hanafi", "maliki", "hanbali"];
const MODES: Mode[] = ["personal", "professional"];

/** Short query keys — the link is meant to be pasted into a WhatsApp message. */
const COUNT_KEYS: Record<string, string> = {
  wives: "w",
  sons: "s",
  daughters: "d",
  grandsons_via_son: "gs",
  granddaughters_via_son: "gd",
  full_brothers: "fb",
  full_sisters: "fs",
  paternal_brothers: "pb",
  paternal_sisters: "ps",
  maternal_siblings: "ms",
};

const BOOL_KEYS: Record<string, string> = {
  husband: "h",
  father: "f",
  mother: "m",
  paternal_grandfather: "gf",
  paternal_grandmother: "gm",
  maternal_grandmother: "mg",
};

const ESTATE_KEYS: Record<keyof EstateInput, string> = {
  gross_value: "gv",
  funeral_costs: "fc",
  debts: "db",
  wasiyya: "wa",
  joint_assets: "ja",
};

export interface ShareableState {
  heirs: HeirsInput;
  estate: EstateInput;
  ruleset: Ruleset;
  mode: Mode;
  hartaBersama: boolean;
  compareMode: boolean;
}

/* --------------------------------------------------------------------- encode */

export function encodeState(state: ShareableState): string {
  const p = new URLSearchParams();
  p.set("r", state.ruleset);
  if (state.mode !== "personal") p.set("mo", state.mode);

  for (const [field, key] of Object.entries(BOOL_KEYS)) {
    if ((state.heirs as Record<string, unknown>)[field]) p.set(key, "1");
  }
  for (const [field, key] of Object.entries(COUNT_KEYS)) {
    const n = Number((state.heirs as Record<string, unknown>)[field] ?? 0);
    if (n > 0) p.set(key, String(n));
  }

  // Substitute heirs: "son:2:1,daughter:0:3" — replacing:sons:daughters.
  const reps = state.heirs.representatives ?? [];
  if (reps.length) {
    p.set("rep", reps.map((r) => `${r.replacing}:${r.sons || 0}:${r.daughters || 0}`).join(","));
  }

  for (const [field, key] of Object.entries(ESTATE_KEYS)) {
    const v = state.estate[field as keyof EstateInput];
    if (v) p.set(key, v);
  }

  if (state.hartaBersama) p.set("hb", "1");
  if (state.compareMode) p.set("cmp", "1");
  return p.toString();
}

/* --------------------------------------------------------------------- decode */

function clampCount(raw: string | null, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, n);
}

/** Accept only a plain non-negative decimal of sane length — this feeds a money field. */
function safeMoney(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (!/^\d{1,20}(\.\d{1,2})?$/.test(raw)) return undefined;
  return raw;
}

function decodeReps(raw: string | null): Representative[] {
  if (!raw) return [];
  return raw
    .split(",")
    .slice(0, 20) // a link should not be able to mount an unbounded form
    .map((chunk) => {
      const [replacing, sons, daughters] = chunk.split(":");
      if (replacing !== "son" && replacing !== "daughter") return null;
      const rep: Representative = {
        replacing,
        sons: clampCount(sons ?? null, MAX_COUNT),
        daughters: clampCount(daughters ?? null, MAX_COUNT),
      };
      return rep.sons + rep.daughters > 0 ? rep : null;
    })
    .filter((r): r is Representative => r !== null);
}

/**
 * Parse a query string into form state. Returns null when there is nothing to restore, so
 * the caller can leave its defaults alone rather than clobbering them with an empty form.
 */
export function decodeState(search: string): ShareableState | null {
  const p = new URLSearchParams(search);
  if (![...p.keys()].length) return null;

  const rulesetRaw = p.get("r");
  const ruleset: Ruleset = RULESETS.includes(rulesetRaw as Ruleset)
    ? (rulesetRaw as Ruleset)
    : "khi";
  const modeRaw = p.get("mo");
  const mode: Mode = MODES.includes(modeRaw as Mode) ? (modeRaw as Mode) : "personal";

  const heirs: HeirsInput = {};
  for (const [field, key] of Object.entries(BOOL_KEYS)) {
    if (p.get(key) === "1") (heirs as Record<string, unknown>)[field] = true;
  }
  for (const [field, key] of Object.entries(COUNT_KEYS)) {
    const n = clampCount(p.get(key), field === "wives" ? MAX_WIVES : MAX_COUNT);
    if (n > 0) (heirs as Record<string, unknown>)[field] = n;
  }

  // Mirrors the form's own rule: a husband and wives are mutually exclusive.
  if (heirs.husband && (heirs.wives ?? 0) > 0) delete heirs.wives;

  // Substitute heirs and harta bersama are KHI-only; build_input drops them for other
  // rule sets anyway, so don't restore state the form would immediately hide.
  const isKhi = ruleset === "khi";
  if (isKhi) {
    const reps = decodeReps(p.get("rep"));
    if (reps.length) heirs.representatives = reps;
  }

  const estate: EstateInput = {};
  for (const [field, key] of Object.entries(ESTATE_KEYS)) {
    const v = safeMoney(p.get(key));
    if (v) estate[field as keyof EstateInput] = v;
  }

  return {
    heirs,
    estate,
    ruleset,
    mode,
    hartaBersama: isKhi && p.get("hb") === "1",
    compareMode: p.get("cmp") === "1",
  };
}

/**
 * Write state into the address bar without a navigation. `history.replaceState` rather than
 * Next's router: this is a single statically-exported route, and a router push would
 * re-render the tree for what is purely an address-bar update.
 */
export function writeStateToUrl(state: ShareableState): void {
  if (typeof window === "undefined") return;
  const query = encodeState(state);
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  try {
    window.history.replaceState(null, "", url);
  } catch {
    /* Non-fatal: sharing degrades, the calculator keeps working. */
  }
}

/**
 * Drop the case from the address bar without navigating, so a cleared calculator does not
 * leave the previous family's heirs and estate sitting in a URL the user may then share,
 * bookmark, or hand to someone across a desk.
 */
export function clearStateFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* Non-fatal: the in-memory state is cleared regardless. */
  }
}

export function currentShareUrl(state: ShareableState): string {
  if (typeof window === "undefined") return "";
  const query = encodeState(state);
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
}
