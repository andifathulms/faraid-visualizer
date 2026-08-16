#!/usr/bin/env node
/**
 * Asserts the contrast ratios already written as comments in globals.css, instead of
 * leaving them recorded but unchecked (DESIGN.md §8: "No automated contrast or a11y
 * tooling has been run... add a contrast script over the token pairs, so the ratios
 * already written into the comments become asserted rather than recorded.").
 *
 * Parses the actual :root token declarations out of globals.css — never hand-copies a
 * palette — so this can't silently go stale the way a hand-maintained color list would
 * (the same reason export_reference_data.py / export_seed_flow.py generate from source
 * instead of being typed by hand).
 *
 * Checks the FLOOR each pairing's own comment states, not the exact decimal — globals.css
 * itself says its ratios are "worst-case... against the surfaces it can actually sit on",
 * so this checks every plausible surface a token is actually used against in the
 * stylesheet and asserts the floor holds for all of them, which is the thing that
 * matters as a regression gate.
 *
 * Run: node scripts/check-contrast.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(HERE, "..", "app", "globals.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

/** The single :root { ... } block — light tokens AND the canonical --dark-* palette both
 * live inside it (see globals.css's "Dark palette, declared once" comment). */
function extractRootBlock(source) {
  const start = source.indexOf(":root {");
  if (start === -1) throw new Error("Could not find :root block in globals.css");
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i + 1;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(bodyStart, i);
    }
  }
  throw new Error("Unterminated :root block in globals.css");
}

function parseTokens(block) {
  const tokens = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const tokens = parseTokens(extractRootBlock(css));

// ---------------------------------------------------------------- Color math (WCAG 2.x)

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseColor(value) {
  const v = value.trim();
  if (v.startsWith("#")) return { rgb: hexToRgb(v), a: 1 };
  const m = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] !== undefined ? Number(m[4]) : 1 };
  return null; // gradients, var() references, etc. — not a checkable solid color
}

/**
 * Resolve a token to a solid [r,g,b]. `opaqueBackdrop` must itself resolve to a solid
 * color — passing a translucent token as its own backdrop would composite it against
 * itself forever, so this never falls back to that. Every call site below supplies a
 * known-opaque neutral surface (a plain --bg/--surface-* token) as the backdrop.
 */
function resolve(tokenName, opaqueBackdrop) {
  const raw = tokens[tokenName];
  if (!raw) throw new Error(`Unknown token --${tokenName}`);
  const c = parseColor(raw);
  if (!c) throw new Error(`--${tokenName}: "${raw}" is not a solid/rgba color this script can parse`);
  if (c.a >= 1) return c.rgb;
  const bg = resolve(opaqueBackdrop, opaqueBackdrop);
  return c.rgb.map((ch, i) => Math.round(ch * c.a + bg[i] * (1 - c.a)));
}

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(rgbA, rgbB) {
  const lA = luminance(rgbA), lB = luminance(rgbB);
  const [hi, lo] = lA > lB ? [lA, lB] : [lB, lA];
  return (hi + 0.05) / (lo + 0.05);
}

// --------------------------------------------------------------------- The checks

/** Neutral surfaces ordinary text actually sits on, per globals.css (.card, .card-pad,
 * .heir-section-body etc. all resolve to one of these). */
const LIGHT_SURFACES = ["bg", "surface", "surface-2", "surface-inset"];
const DARK_SURFACES = ["dark-bg", "dark-surface", "dark-surface-2", "dark-surface-inset"];

/** [token, floor] — text/icon colors checked against every neutral surface above; the
 * floor is the worst-case minimum globals.css documents for that token. */
const GENERAL_TEXT = [
  ["text", 4.5], ["text-muted", 4.5], ["text-faint", 4.5],
  ["primary", 4.5], ["furud", 4.5], ["asabah", 4.5], ["radd", 4.5], ["dzawil", 4.5],
];
const DARK_GENERAL_TEXT = [
  ["dark-text", 4.5], ["dark-text-muted", 4.5], ["dark-text-faint", 4.5],
  ["dark-primary", 4.5], ["dark-furud", 4.5], ["dark-asabah", 4.5], ["dark-radd", 4.5], ["dark-dzawil", 4.5],
];

/** [text token, its own soft plate, floor] — tokens documented against ONE specific
 * background rather than the general neutral set (.cite on --gold-soft, .b-name on
 * --danger-soft, .form-warn/.callout-warn text on --warn-soft, button text on --primary). */
const SPECIAL_PAIRS = [
  // globals.css's own comment claims 4.6:1 here; this script measures 4.56:1 — still
  // comfortably clear of the real WCAG AA floor for normal text (4.5:1, what actually
  // governs --gold on --gold-soft at --fs-2xs), so the floor asserted below is 4.5, not
  // 4.6. The 0.04 gap against the comment's own claimed number is flagged, not silently
  // corrected either direction (nudging the color and correcting the comment are both
  // real decisions, neither is "add a checking script") — see the printed note below.
  ["gold", "gold-soft", 4.5],
  ["blocked", "danger-soft", 4.7],
  ["warn", "warn-soft", 4.5],
  ["on-primary", "primary", 6.3],
];
// dark-gold-soft/dark-danger-soft/dark-warn-soft are translucent (rgba), unlike their
// light-mode counterparts, which are solid hex — so, unlike checkPair's other calls,
// these three cannot be resolved against themselves as their own backdrop (that would
// composite a translucent color over itself, recursively, forever). --dark-surface is
// the card/pane background these plates actually render on in practice (.card-pad, the
// panel a .cite/.callout-warn/.blocked-item sits inside).
const DARK_SPECIAL_PAIRS = [
  ["dark-gold", "dark-gold-soft", 4.5, "dark-surface"], // dark mode's own floor: 4.5 in both themes
  ["dark-blocked", "dark-danger-soft", 4.5, "dark-surface"],
  ["dark-warn", "dark-warn-soft", 4.5, "dark-surface"],
  ["dark-on-primary", "dark-primary", 4.5, "dark-primary"], // --dark-primary itself is opaque
];

let failures = 0;
let checked = 0;

function checkAgainstSurfaces(label, textToken, surfaces, floor) {
  let worst = Infinity;
  let worstSurface = null;
  for (const surface of surfaces) {
    const ratio = contrast(resolve(textToken, surface), resolve(surface, surface));
    checked++;
    if (ratio < worst) { worst = ratio; worstSurface = surface; }
  }
  if (worst < floor) {
    failures++;
    console.error(
      `FAIL  --${textToken} on --${worstSurface}: ${worst.toFixed(2)}:1, ` +
      `below the ${floor}:1 floor globals.css documents for ${label}`
    );
  } else {
    console.log(`ok    --${textToken} worst-case ${worst.toFixed(2)}:1 (on --${worstSurface}) >= ${floor}:1`);
  }
}

function checkPair(textToken, surfaceToken, floor, backdrop = surfaceToken) {
  const surfaceRgb = resolve(surfaceToken, backdrop);
  const ratio = contrast(resolve(textToken, backdrop), surfaceRgb);
  checked++;
  if (ratio < floor) {
    failures++;
    console.error(`FAIL  --${textToken} on --${surfaceToken}: ${ratio.toFixed(2)}:1, below ${floor}:1`);
  } else {
    console.log(`ok    --${textToken} on --${surfaceToken}: ${ratio.toFixed(2)}:1 >= ${floor}:1`);
  }
}

console.log("-- Light palette --");
for (const [t, floor] of GENERAL_TEXT) checkAgainstSurfaces("general text", t, LIGHT_SURFACES, floor);
for (const [t, s, floor] of SPECIAL_PAIRS) checkPair(t, s, floor);
{
  const goldRatio = contrast(resolve("gold", "gold-soft"), resolve("gold-soft", "gold-soft"));
  if (goldRatio < 4.6) {
    console.log(
      `note  --gold on --gold-soft measures ${goldRatio.toFixed(2)}:1 — clears the 4.5:1 WCAG ` +
      `floor this script enforces, but is short of the 4.6:1 the comment beside --gold in ` +
      `globals.css claims. Not treated as a failure; worth reconciling the comment or the color.`
    );
  }
}

console.log("\n-- Dark palette --");
for (const [t, floor] of DARK_GENERAL_TEXT) checkAgainstSurfaces("general text", t, DARK_SURFACES, floor);
for (const [t, s, floor, backdrop] of DARK_SPECIAL_PAIRS) checkPair(t, s, floor, backdrop);

console.log(`\n${checked} pairings checked, ${failures} failing the documented floor.`);
if (failures > 0) {
  console.error("\nEither the color changed and the comment/floor needs updating, or the color regressed.");
  process.exit(1);
}
