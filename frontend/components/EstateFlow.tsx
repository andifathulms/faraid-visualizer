"use client";

// EstateFlow — DESIGN.md §5. The estate descending through the pipeline, splitting,
// every split a cited rule. Hand-authored SVG with computed widths: the pipeline is
// fixed (PRD §5.2 order), not an arbitrary graph, so it needs no graph library.
//
// STANDALONE (DESIGN.md build order step 1): this component is not imported by
// app/page.tsx. It is driven entirely by `CalculationResult`, the same structured
// derivation ResultView already renders — every number drawn here already exists on
// that object or is plain arithmetic over fields it already carries (e.g. a pre-'aul
// claimed fraction is `numerator / pokok_masalah`, both already on the result). Nothing
// here calls the engine, adds a rule, or invents a share.
//
// A stage that did not fire is not drawn (DESIGN.md §5.1). An 'aul base outside the
// engine's own valid set (aul.py: 6→{7,8,9,10}, 12→{13,15,17}, 24→{27}) is refused, not
// drawn — a bug indicator, per CLAUDE.md, not a new case. An UnsupportedConfiguration is
// rendered with the app's existing amber treatment, never softened into a drawn guess.

import { CSSProperties, useId, useState } from "react";
import { Blocked, CalculationResult, Lang, Share, SourceCitation, citationNote } from "@/lib/api";
import { formatMoney } from "@/lib/format";

/* ------------------------------------------------------------------- Input */

export interface UnsupportedFlow {
  kind: "unsupported";
  /** The engine's own refusal message (CalculationError.message / bridge `detail`). */
  detail: string;
}
export interface ResultFlow {
  kind: "result";
  result: CalculationResult;
}
export type EstateFlowInput = ResultFlow | UnsupportedFlow;

export interface EstateFlowProps {
  input: EstateFlowInput;
  lang: Lang;
  /**
   * DESIGN.md §7 (compare mode): "Both flows share one scale. Different scales would
   * make the comparison a lie." KHI and Syafi'i run the SAME request (same gross value,
   * same deductions), so those stay comparable at a fixed width regardless — but KHI's
   * harta-bersama separation can leave it with a smaller net_divisible than the
   * counterpart ruleset computed from the identical input. Left undefined, a flow scales
   * its net-divisible-onward stages to its OWN net_divisible (today's single-column
   * behaviour, unchanged). Passed the larger of the compared entries' net_divisible
   * amounts, both flows instead scale against that shared reference, so a ruleset that
   * kept less to distribute visibly draws a narrower trunk from that point down — not a
   * wager 100%-width bar telling the same lie two different absolute amounts.
   */
  scaleMaxNet?: string | null;
  /**
   * DESIGN.md §7: in compare mode, "they diverge at a specific gold line, and everything
   * above that line is identical." The engine's `Step.step` key (e.g. "radd", "furud")
   * of the first stage at which this ruleset's derivation actually differs from the
   * counterpart being compared against — computed by ComparisonView, which is the one
   * place two full derivations are ever in scope together. Undefined outside compare
   * mode, where there is no counterpart to diverge from.
   */
  highlightStep?: string | null;
}

/* -------------------------------------------------------------- Local copy
   Not yet in lib/strings.ts: this component is standalone (not wired into the app),
   and DESIGN.md's build order wires citation/i18n integration in a later step. Kept
   bilingual now so the harness can screenshot both. */

const T = {
  gross: { id: "Harta kotor", en: "Gross estate" },
  net: { id: "Harta waris bersih", en: "Net divisible estate" },
  funeral: { id: "Biaya pemakaman", en: "Funeral costs" },
  debts: { id: "Utang", en: "Debts" },
  wasiyya: { id: "Wasiat", en: "Wasiat (bequest)" },
  deductions: { id: "Pengurangan atas harta", en: "Deductions from the estate" },
  hb: { id: "Harta bersama pasangan", en: "Spousal joint property" },
  noEstate: {
    id: "Tidak ada nilai harta yang dimasukkan — hanya pecahan yang ditampilkan.",
    en: "No estate value entered — fractions only.",
  },
  hajb: { id: "Penghalangan (hajb)", en: "Blocking (hajb)" },
  blockedBy: { id: "terhalang oleh", en: "blocked by" },
  furud: { id: "Bagian tetap (furud)", en: "Fixed shares (furud)" },
  asabah: { id: "Sisa (asabah)", en: "Residuary (asabah)" },
  aulRatio: { id: "'aul", en: "'aul" },
  aulClaimed: { id: "diklaim", en: "claimed" },
  aulCompressed: { id: "setelah 'aul", en: "after 'aul" },
  radd: { id: "radd", en: "radd" },
  raddExcluded: { id: "tidak menerima radd", en: "excluded from radd" },
  dzawil: { id: "Dzawil arham", en: "Distant kindred (dzawil arham)" },
  biNafsihi: { id: "asabah sendiri", en: "in own right" },
  biGhairihi: { id: "asabah bersama laki-laki", en: "made residuary by a male" },
  maaGhairihi: { id: "asabah bersama saudari", en: "residuary alongside a sister" },
  unsupportedTitle: { id: "Konfigurasi ini belum didukung", en: "This configuration isn't supported yet" },
  citationHint: { id: "Aktifkan untuk melihat rujukan", en: "Activate to see the citation" },
  aulInvalidTitle: { id: "Rasio 'aul tidak valid — ditolak", en: "Invalid 'aul ratio — refused" },
  divergesHere: { id: "beda mulai di sini", en: "diverges here" },
} as const;

function tr(entry: { id: string; en: string }, lang: Lang): string {
  return entry[lang] ?? entry.id;
}

const asabahTypeLabel = (t: string | null, lang: Lang): string => {
  if (t === "bi_nafsihi") return tr(T.biNafsihi, lang);
  if (t === "bi_ghairihi") return tr(T.biGhairihi, lang);
  if (t === "maa_ghairihi") return tr(T.maaGhairihi, lang);
  return "";
};

/** aul.py VALID_AUL, restated here only as a display-time guard (DESIGN.md "Do not
 * draw an 'aul ratio outside the valid set"). The engine is the source of truth; this
 * never decides validity, it only refuses to draw what the engine could not have sent. */
const VALID_AUL: Record<number, number[]> = { 6: [7, 8, 9, 10], 12: [13, 15, 17], 24: [27] };

/* ------------------------------------------------------------------ Layout */

const W = 600; // total SVG canvas width
// The trunk (bars, furud/asabah/radd rows) is drawn against TRUNK_W, not the full
// canvas — the remaining margin is reserved headroom so an 'aul overhang row (DESIGN.md
// §5.5: "a visible overhang past the trunk's width") has somewhere to go without
// escaping the SVG's own viewBox, and so hajb branch labels have room in the margin
// rather than crowding the last segment.
const MARGIN_R = 96;
const TRUNK_W = W - MARGIN_R;
const BAR_H = 40;
const GAP_XS = 6;
const GAP_S = 12;
const GAP_M = 22;
const CITE_H = 26;
const HAJB_SPINE_X = 20;
const HAJB_GROUP_HEAD_H = 22;
const HAJB_ITEM_H = 24;
const HAJB_GROUP_GAP = 8;
const SEG_MIN_W = 3;

const COLOR = {
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  border: "var(--border-strong)",
  text: "var(--text)",
  muted: "var(--text-muted)",
  faint: "var(--text-faint)",
  gold: "var(--gold)",
  furud: "var(--furud)",
  asabah: "var(--asabah)",
  radd: "var(--radd)",
  dzawil: "var(--dzawil)",
  blocked: "var(--blocked)",
} as const;

interface Seg {
  key: string;
  x: number;
  w: number;
  color: string;
  label: string;
  sub: string;
  fracText: string;
  amountText: string;
  markRadd?: boolean;
  markExcluded?: boolean;
}

function shareWidths(shares: Share[], trunkW: number): { x: number; w: number }[] {
  let x = 0;
  const out: { x: number; w: number }[] = [];
  for (const s of shares) {
    const w = Math.max(SEG_MIN_W, s.share.float * trunkW);
    out.push({ x, w });
    x += w;
  }
  return out;
}

/* --------------------------------------------------------------- Component */

export default function EstateFlow({ input, lang, scaleMaxNet, highlightStep }: EstateFlowProps) {
  const uid = useId();
  const [openCite, setOpenCite] = useState<string | null>(null);

  if (input.kind === "unsupported") {
    return (
      <div className="unsupported-box" role="group" aria-label={tr(T.unsupportedTitle, lang)}>
        <div>
          <strong>{tr(T.unsupportedTitle, lang)}</strong>
          <div className="u-detail">{input.detail}</div>
        </div>
      </div>
    );
  }

  const result = input.result;
  const e = result.estate;
  const hasMoney = !!e && Number(e.net_divisible) > 0;
  const awarded = result.shares.filter((s) => s.category !== "harta_bersama");

  // Reference width for every stage from "net divisible" downward (hajb, furud, 'aul,
  // radd, asabah, dzawil) — TRUNK_W scaled to this flow's own net_divisible share of
  // scaleMaxNet when a shared scale is supplied, else TRUNK_W unchanged (the ordinary
  // single-column case, and the "no estate entered" fractions-only case).
  const netDivisible = hasMoney ? Number(e!.net_divisible) : 0;
  const scaleRef = scaleMaxNet != null && Number(scaleMaxNet) > 0 ? Number(scaleMaxNet) : netDivisible;
  const netScale = hasMoney && scaleRef > 0 ? Math.min(1, netDivisible / scaleRef) : 1;
  const distW = hasMoney ? Math.max(SEG_MIN_W, netScale * TRUNK_W) : TRUNK_W;

  // 'Aul validity guard — refuse to draw an impossible ratio (DESIGN.md "Do not").
  if (result.aul_applied && result.aul_base != null) {
    const valid = VALID_AUL[result.pokok_masalah]?.includes(result.aul_base);
    if (!valid) {
      return (
        <div className="unsupported-box" role="alert">
          <div>
            <strong>{tr(T.aulInvalidTitle, lang)}</strong>
            <div className="u-detail">
              pokok_masalah={result.pokok_masalah} → aul_base={result.aul_base}
            </div>
          </div>
        </div>
      );
    }
  }

  const blocks: JSX.Element[] = [];
  // Citation buttons — rendered as an HTML overlay OUTSIDE the aria-hidden svg; see
  // citeLine()'s comment for why. `y`/`h` are in the same SVG user-coordinate units as
  // everything else and get converted to a percentage of totalH at render time, once
  // totalH is known.
  const citeOverlays: { key: string; y: number; h: number; node: JSX.Element }[] = [];
  let y = 0;

  const src = (id: string | null | undefined): SourceCitation | undefined =>
    id ? result.sources[id] : undefined;

  /**
   * A step can apply MORE than one rule (furud assigns a different basis per heir, hajb
   * excludes each blocked heir under its own citation) — mirrors ResultView.tsx's
   * stepSources(), the existing pattern for exactly this case, so a stage with mixed
   * sources still gets a gold line instead of silently having none.
   */
  function stepSourceIds(step: { source_id: string | null; data?: Record<string, unknown> } | undefined): string[] {
    const many = step?.data?.source_ids;
    if (Array.isArray(many) && many.length) return many.filter((x): x is string => typeof x === "string");
    return step?.source_id ? [step.source_id] : [];
  }

  /**
   * Gold rule-line, positioned to align with the stage transition it belongs to
   * (DESIGN.md §5.4: "the visible skeleton of the derivation", not a list beside it). A
   * real <button>, so it is keyboard-focusable in pipeline/DOM order; activating it
   * reveals every citation the stage applied — the same reference + note ShareItem's
   * "why?" disclosure used to carry, one block per source when more than one fired.
   *
   * NOT drawn inside the <svg> — an earlier version put it there via <foreignObject>,
   * which scripts/check-a11y.mjs caught (axe rule aria-hidden-focus) before it shipped:
   * the svg root is aria-hidden="true" (DESIGN.md §5.6 — the diagram is genuinely
   * decorative, the working table below is its real text equivalent), so a real,
   * independently valuable focusable control living inside it is reachable by keyboard
   * but invisible to a screen reader. aria-hidden="false" on the descendant is
   * spec-legal but unreliably honored (this axe rule doesn't respect it, and neither do
   * some AT/browser combinations) — the only robust fix is structural: this renders as
   * plain HTML, a sibling of the svg, absolutely positioned to the same y using a
   * percentage of the shared total height so it tracks the svg's own responsive scaling
   * without needing to measure anything at runtime.
   */
  function citeLine(key: string, sourceIds: string[], label: string, opts: { divergent?: boolean } = {}) {
    const found = sourceIds.map((id) => src(id)).filter((s): s is SourceCitation => !!s);
    if (found.length === 0) return;
    const isOpen = openCite === key;
    // Citation chips always stack one per row below the label+rule line, rather than
    // wrapping inline with it — a stage with several distinct sources (hajb blocking
    // three different heirs under three different citations is the case that broke
    // this) made an inline flex-wrap row's real rendered height depend on the
    // container's pixel width, which this component has no way to know at layout time
    // (the SVG scales responsively; a row that fits on one line at 1440px can wrap at
    // 320px, or even at 1440px once there are simply enough chips). A fixed, one-row
    // height reserved for content that can silently become two rows is exactly the bug
    // class the branches() label fix (see its own comment) already fixed once — this
    // makes the same mistake unreachable here by never wrapping in the first place:
    // each row's content is one short chip, which does not itself wrap at any
    // reasonable width, so the height this reserves is always exactly right.
    const CHIP_ROW_H = 15;
    const closedH = CITE_H + found.length * CHIP_ROW_H;
    const h = isOpen ? closedH + found.length * 32 : closedH;
    const cy = y;
    const btnId = `${uid}-${key}`;
    citeOverlays.push({
      key,
      y: cy,
      h,
      node: (
        <button
          type="button"
          id={btnId}
          aria-expanded={isOpen}
          aria-controls={`${btnId}-panel`}
          onClick={() => setOpenCite(isOpen ? null : key)}
          style={{
            width: "100%", border: "none", background: "transparent", cursor: "pointer",
            padding: "5px 0 0", fontFamily: "var(--sans)", textAlign: "left", display: "block",
          }}
          title={tr(T.citationHint, lang)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* DESIGN.md §7: "they diverge at a specific gold line" — the compared
                counterpart is identical everywhere above this. Stays inside the gold
                family (badge-gold), never the warning/error treatment — a divergence
                between two bodies of law is information, per DivergenceNotice's own
                existing, deliberately-non-alarming styling. */}
            {opts.divergent && (
              <span className="badge badge-gold" style={{ whiteSpace: "nowrap" }}>{tr(T.divergesHere, lang)}</span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {label}
            </span>
            <span
              aria-hidden="true"
              style={{
                flex: 1, minWidth: 12, background: "var(--gold)",
                height: opts.divergent ? 2 : 1,
                opacity: isOpen || opts.divergent ? 1 : 0.55,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginTop: 2 }}>
            {found.map((s) => (
              <span className="cite" style={{ marginLeft: 0 }} key={s.id}>{s.pointer}</span>
            ))}
          </div>
          {isOpen && (
            <div id={`${btnId}-panel`} style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              {found.map((s) => (
                <div key={s.id} style={{ fontSize: 10, lineHeight: 1.4, color: "var(--text-muted)", whiteSpace: "normal" }}>
                  <strong style={{ color: "var(--text)" }}>{s.reference}</strong> — {citationNote(s, lang)}
                </div>
              ))}
            </div>
          )}
        </button>
      ),
    });
    y += h;
  }

  function citeAnchor(
    key: string,
    step: { step?: string; source_id: string | null; data?: Record<string, unknown> } | undefined,
    label: string
  ) {
    citeLine(key, stepSourceIds(step), label, {
      divergent: !!highlightStep && step?.step === highlightStep,
    });
  }

  function bar(key: string, label: string, sub: string, w = TRUNK_W) {
    blocks.push(
      <g key={key}>
        <rect x={0} y={y} width={w} height={BAR_H} rx={6} fill={COLOR.surface2} stroke={COLOR.border} />
        <foreignObject x={8} y={y} width={w - 16} height={BAR_H}>
          <div style={boxStyle}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>
          </div>
        </foreignObject>
      </g>
    );
    y += BAR_H;
  }

  function deduction(key: string, label: string, amount: string) {
    // A segment peeled from the right, per DESIGN.md §5.1 stage 2 — sequential, not a
    // single lump, so the KHI Pasal 175/176 ordering stays visible.
    blocks.push(
      <g key={key}>
        <rect x={0} y={y} width={TRUNK_W} height={GAP_XS + 22} fill="none" />
        <foreignObject x={0} y={y} width={TRUNK_W} height={22}>
          <div style={{ ...boxStyle, flexDirection: "row", justifyContent: "space-between", height: 22 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>− {label}</span>
            <span className="tabnum" style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {formatMoney(amount, lang)}
            </span>
          </div>
        </foreignObject>
      </g>
    );
    y += 22 + GAP_XS;
  }

  function segRow(key: string, segs: Seg[], rowH = 68, overhangPastTrunk?: number) {
    const maxX = overhangPastTrunk ?? distW;
    // Below this width a segment cannot fit every line without clipping inside its
    // foreignObject (SVG clips foreignObject content to its own box, unlike an
    // ordinary HTML overflow). Rather than let text spill invisibly, drop the two
    // optional lines (sub, amount) and keep the two that identify the segment (label,
    // fraction) — narrow siham groups are exactly where the working table below
    // already carries the exact per-head figure.
    //
    // KNOWN LIMIT, not yet solved: a segment under ~30px (e.g. the 1/24 wife's share
    // in a 4-way 'aul case) still clips its label/fraction — the one pair this
    // function does not drop. DESIGN.md requires the geometry to stay proportional
    // (§5.2) and does not say what should give at the extreme narrow end; solving it
    // (a leader line off to the side, matching how branches() already labels hajb
    // stops) is deferred to the wiring step rather than guessed at here.
    const NARROW = 90;
    blocks.push(
      <g key={key}>
        {maxX > distW && (
          <line x1={distW} y1={y - 4} x2={distW} y2={y + rowH + 4} stroke={COLOR.blocked} strokeDasharray="3 3" />
        )}
        {segs.map((s) => {
          const narrow = s.w < NARROW;
          return (
            <g key={s.key}>
              <rect
                x={s.x}
                y={y}
                width={s.w}
                height={rowH}
                fill={s.color}
                opacity={0.16}
                stroke={s.color}
                strokeOpacity={0.55}
              />
              <foreignObject x={s.x + 4} y={y + 3} width={Math.max(s.w - 8, 1)} height={rowH - 6}>
                <div style={segStyle}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                    {s.label}
                    {s.markRadd && <span title={tr(T.radd, lang)} style={{ color: "var(--radd)" }}> ↩</span>}
                  </span>
                  {!narrow && s.sub && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.sub}</span>}
                  <span className="frac" style={{ fontSize: 13 }}>{s.fracText}</span>
                  {!narrow && s.amountText && (
                    <span className="tabnum" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {s.amountText}
                    </span>
                  )}
                  {!narrow && s.markExcluded && (
                    <span style={{ fontSize: 9, color: "var(--danger)", fontWeight: 700 }}>
                      {tr(T.raddExcluded, lang)}
                    </span>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </g>
    );
    y += rowH + GAP_S;
  }

  /**
   * Blocked heirs, as a real tree: a spine drops from the hajb citation line (so it
   * visibly hangs off something, not floating in blank space — the original version's
   * biggest legibility problem) and branches to one node per DISTINCT blocker, which
   * then sub-branches to every heir that blocker excludes. Mirrors the exact grouping
   * SensitivityPanel.tsx already uses for this same shape of information ("several
   * heirs sharing one blocker collapse onto a single row... the grouping IS the
   * insight") — geometry now encodes who-blocks-whom instead of N identical parallel
   * lines a reader has to read as text to tell apart.
   *
   * A blocker's group header is colored to match that heir's OWN segment further down
   * (furud green / asabah blue / radd purple) when they are themselves awarded a share
   * — which they always are, structurally: a hajb blocker is by definition a closer
   * heir, so the same lookup that colors furud/asabah segments elsewhere finds them
   * here too. That is a real, free visual link from "blocked by X" to X's own share,
   * without drawing a line across the whole diagram to find it.
   *
   * Uses the full trunk width (distW), not a narrow margin strip — on top of the
   * generous per-row height below, this makes the wrap-driven clipping bug this
   * component has already hit twice structurally harder to hit a third time.
   */
  function branches(entries: Blocked[]) {
    const groups: { blockerRelation: string; blockerLabel: string; color: string; items: Blocked[] }[] = [];
    const indexByBlocker = new Map<string, number>();
    for (const b of entries) {
      let idx = indexByBlocker.get(b.blocked_by);
      if (idx === undefined) {
        const blockerShare = awarded.find((s) => s.relation === b.blocked_by);
        const color =
          blockerShare?.category === "furud" ? COLOR.furud :
          blockerShare?.category === "asabah" ? COLOR.asabah :
          blockerShare?.category === "radd" ? COLOR.radd :
          COLOR.blocked;
        idx = groups.length;
        groups.push({ blockerRelation: b.blocked_by, blockerLabel: b.blocked_by_label, color, items: [] });
        indexByBlocker.set(b.blocked_by, idx);
      }
      groups[idx].items.push(b);
    }

    y += 6; // small breathing room below the citation line the spine hangs from
    const spineTop = y;

    groups.forEach((g) => {
      const groupY = y;
      blocks.push(
        <g key={`hajb-g-${g.blockerRelation}`}>
          <circle cx={HAJB_SPINE_X} cy={groupY} r={3} fill={g.color} />
          {/* Blocker's name — cue #3 of 3 (dash pattern and stop mark are cues #1/#2,
              per item below). Shared once per group rather than repeated per heir —
              still immediately, visually adjacent to every dash it explains, via the
              same spine, matching SensitivityPanel's established precedent for this
              exact "several things, one cause" shape. */}
          <foreignObject x={HAJB_SPINE_X + 12} y={groupY - 10} width={distW - HAJB_SPINE_X - 12} height={HAJB_GROUP_HEAD_H}>
            <div style={{ display: "flex", alignItems: "center", height: HAJB_GROUP_HEAD_H }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: g.color }}>
                {tr(T.blockedBy, lang)} {g.blockerLabel}
              </span>
            </div>
          </foreignObject>
        </g>
      );
      y += HAJB_GROUP_HEAD_H;

      g.items.forEach((b) => {
        const itemY = y;
        const stopX = HAJB_SPINE_X + 20;
        blocks.push(
          <g key={b.relation}>
            {/* Dash pattern — cue #1 of 3. */}
            <line x1={HAJB_SPINE_X} y1={itemY} x2={stopX} y2={itemY} stroke={COLOR.blocked} strokeDasharray="3 3" strokeWidth={1.4} />
            {/* Stop mark — cue #2 of 3. */}
            <line x1={stopX} y1={itemY - 5} x2={stopX} y2={itemY + 5} stroke={COLOR.blocked} strokeWidth={2} />
            <foreignObject x={stopX + 8} y={itemY - 9} width={distW - stopX - 8} height={HAJB_ITEM_H}>
              <div style={{ display: "flex", alignItems: "center", height: HAJB_ITEM_H }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--blocked)", textDecoration: "line-through" }}>
                  {b.label}{b.count > 1 ? ` ×${b.count}` : ""}
                </span>
              </div>
            </foreignObject>
          </g>
        );
        y += HAJB_ITEM_H;
      });
      y += HAJB_GROUP_GAP;
    });

    // Painted last so it sits at the same x every branch-point circle already occupies
    // (a line passing through their centers reads as "nodes on a spine", which is the
    // intent) — pushed after the groups only because their total height isn't known
    // until they're laid out; z-order here is cosmetically inconsequential.
    const spineBottom = y - HAJB_GROUP_GAP;
    blocks.push(
      <line
        key="hajb-spine"
        x1={HAJB_SPINE_X} y1={spineTop} x2={HAJB_SPINE_X} y2={spineBottom}
        stroke="var(--border-strong)" strokeWidth={1.5}
      />
    );
  }

  // ---- Stage 1–3: gross → deductions → net (only if an estate was entered) --------
  if (hasMoney && e) {
    bar("gross", tr(T.gross, lang), formatMoney(e.gross_value, lang));
    y += GAP_XS;
    const debtsStep = result.steps.find((s) => s.step === "debts");
    if (Number(e.funeral_costs) > 0) deduction("d-funeral", tr(T.funeral, lang), e.funeral_costs);
    if (Number(e.debts) > 0) deduction("d-debts", tr(T.debts, lang), e.debts);
    if (Number(e.wasiyya) > 0) deduction("d-wasiyya", tr(T.wasiyya, lang), e.wasiyya);
    citeAnchor("cite-debts", debtsStep, tr(T.deductions, lang));
    if (Number(e.harta_bersama_deducted) > 0) {
      const hbStep = result.steps.find((s) => s.step === "harta_bersama");
      deduction("d-hb", tr(T.hb, lang), e.harta_bersama_deducted);
      citeAnchor("cite-hb", hbStep, tr(T.hb, lang));
    }
    bar("net", tr(T.net, lang), formatMoney(e.net_divisible, lang), distW);
  } else {
    bar("net-frac", tr(T.net, lang), tr(T.noEstate, lang));
  }
  y += GAP_M;

  // ---- Stage 4: hajb — blocked heirs branch off and terminate ---------------------
  if (result.blocked.length > 0) {
    const hajbStep = result.steps.find((s) => s.step === "hajb");
    citeAnchor("cite-hajb", hajbStep, tr(T.hajb, lang));
    branches(result.blocked);
    y += GAP_S;
  }

  // ---- Stages 5–7: furud / 'aul / radd / asabah ------------------------------------
  const furudGroup = awarded.filter((s) => s.category === "furud" || s.category === "radd");
  const asabahGroup = awarded.filter((s) => s.category === "asabah");

  function segFor(s: Share, x: number, w: number, opts: { markRadd?: boolean; markExcluded?: boolean } = {}): Seg {
    return {
      key: s.relation,
      x,
      w,
      color:
        s.category === "furud" ? COLOR.furud :
        s.category === "radd" ? COLOR.radd :
        s.category === "asabah" ? COLOR.asabah : COLOR.dzawil,
      label: s.label + (s.count > 1 ? ` ×${s.count}` : ""),
      sub: s.category === "asabah" ? asabahTypeLabel(s.asabah_type, lang) : "",
      fracText: s.share.text,
      amountText: hasMoney ? formatMoney(s.amount, lang) : "",
      markRadd: opts.markRadd,
      markExcluded: opts.markExcluded,
    };
  }

  if (furudGroup.length > 0) {
    const furudStep = result.steps.find((s) => s.step === "furud");
    citeAnchor("cite-furud", furudStep, tr(T.furud, lang));

    if (result.aul_applied && result.aul_base != null) {
      // Overhang row: claimed shares BEFORE 'aul. `numerator` is held constant by
      // apply_aul (aul.py) — the claimed fraction is numerator / pokok_masalah, both
      // already on the result; nothing here is a new number.
      const claimed = furudGroup.map((s) => ({
        s,
        frac: `${s.share.numerator}/${result.pokok_masalah}`,
        float: s.share.numerator / result.pokok_masalah,
      }));
      let cx = 0;
      const overSegs: Seg[] = claimed.map(({ s, frac, float }) => {
        const w = Math.max(SEG_MIN_W, float * distW);
        const seg = segFor(s, cx, w);
        seg.fracText = frac;
        seg.amountText = "";
        cx += w;
        return seg;
      });
      segRow("aul-claimed", overSegs, 50, cx);
      blocks.push(
        <foreignObject key="aul-ratio" x={0} y={y} width={TRUNK_W} height={20}>
          <div style={{ ...boxStyle, flexDirection: "row", gap: 6, height: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>
              {tr(T.aulRatio, lang)}: {result.pokok_masalah} → {result.aul_base} ({tr(T.aulClaimed, lang)} → {tr(T.aulCompressed, lang)})
            </span>
          </div>
        </foreignObject>
      );
      y += 20 + GAP_XS;
      const aulStep = result.steps.find((s) => s.step === "aul");
      citeAnchor("cite-aul", aulStep, tr(T.aulRatio, lang));
      const compWidths = shareWidths(furudGroup, distW);
      const compSegs = furudGroup.map((s, i) => segFor(s, compWidths[i].x, compWidths[i].w));
      segRow("aul-compressed", compSegs);
    } else {
      // apply_radd() (radd.py) is called whenever there's a furud-only surplus with no
      // asabah, and it ALWAYS appends a "radd" step — including the branches where it
      // decides NOT to redistribute (radd_applied stays false) and the surplus escheats
      // to baitul mal instead. That routing choice is itself one of the three PRD §4.1
      // divergence points named explicitly (KHI practice applies radd to a sole spouse;
      // the classical majority view sends the surplus to baitul mal), so the step's
      // presence — not radd_applied — is what decides whether this gets a gold line.
      const widths = shareWidths(furudGroup, distW);
      const segs = furudGroup.map((s, i) =>
        segFor(s, widths[i].x, widths[i].w, {
          markRadd: s.category === "radd",
          markExcluded: result.radd_applied && s.category === "furud",
        })
      );
      segRow(result.radd_applied ? "furud-radd" : "furud", segs);
      const raddStep = result.steps.find((s) => s.step === "radd");
      if (raddStep) citeAnchor("cite-radd", raddStep, tr(T.radd, lang));
    }
  }

  if (asabahGroup.length > 0) {
    const asabahStep = result.steps.find((s) => s.step === "asabah");
    citeAnchor("cite-asabah", asabahStep, tr(T.asabah, lang));
    const widths = shareWidths(asabahGroup, distW);
    const segs = asabahGroup.map((s, i) => segFor(s, widths[i].x, widths[i].w));
    segRow("asabah", segs);
  }

  // ---- Stage 8: dzawil arham — only if the pipeline actually assigned it ----------
  const dzawilGroup = awarded.filter((s) => s.category === "dzawil_arham");
  if (dzawilGroup.length > 0) {
    citeLine("cite-dzawil", Array.from(new Set(dzawilGroup.map((s) => s.source_id))), tr(T.dzawil, lang));
    const widths = shareWidths(dzawilGroup, distW);
    const segs = dzawilGroup.map((s, i) => segFor(s, widths[i].x, widths[i].w));
    segRow("dzawil", segs);
  }

  const totalH = y;

  return (
    // overflow:visible (not the .flow-wrap class's own overflow:hidden, kept for
    // DerivationFlow) — an 'aul overhang has to actually be visible past the trunk.
    <div className="flow-wrap" style={{ height: "auto", padding: 12, background: "var(--surface)", overflow: "visible" }}>
      {/* position:relative anchors the citation overlay below to the same box the svg
          occupies, so a percentage `top` lines each button up with its y in the svg's
          own coordinate system — that box scales with viewport width exactly as the svg
          does (same width, height set by the svg's own intrinsic aspect ratio), so the
          two stay aligned without measuring anything at runtime. */}
      <div style={{ position: "relative" }}>
        <svg
          role="img"
          aria-hidden="true"
          viewBox={`0 0 ${W} ${totalH}`}
          width="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          {blocks}
        </svg>
        {citeOverlays.map((c) => (
          <div
            key={c.key}
            style={{
              position: "absolute",
              left: 0, right: 0,
              top: `${(c.y / totalH) * 100}%`,
              height: `${(c.h / totalH) * 100}%`,
            }}
          >
            {c.node}
          </div>
        ))}
      </div>

      {/* Screen-reader / no-JS text equivalent: the working table below is the real
          alternative (DESIGN.md §5.6) — this just says so, matching DerivationFlow's
          existing sr-only fallback pattern. */}
      <p className="sr-only">
        {lang === "id"
          ? "Diagram alur harta. Tabel bagian di bawah adalah bentuk teks yang setara."
          : "Estate flow diagram. The working table below is the text equivalent."}
      </p>
    </div>
  );
}

const boxStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "100%",
  fontFamily: "var(--sans)",
  color: "var(--text)",
  lineHeight: 1.2,
};

const segStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "100%",
  fontFamily: "var(--sans)",
  color: "var(--text)",
  lineHeight: 1.25,
  overflow: "hidden",
};
