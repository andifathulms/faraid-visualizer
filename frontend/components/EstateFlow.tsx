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
const CITE_H_OPEN = 62;
const BRANCH_ROW_H = 34;
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

export default function EstateFlow({ input, lang }: { input: EstateFlowInput; lang: Lang }) {
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
  let y = 0;

  const src = (id: string | null | undefined): SourceCitation | undefined =>
    id ? result.sources[id] : undefined;

  /**
   * Gold rule-line, drawn IN PLACE at the stage transition it belongs to (DESIGN.md
   * §5.4: "the visible skeleton of the derivation", not a list beside it). A real
   * <button>, so it is keyboard-focusable in pipeline/DOM order; activating it reveals
   * the same reference + note ShareItem's "why?" disclosure already carries.
   */
  function citeAnchor(key: string, sourceId: string | null | undefined, label: string) {
    const s = src(sourceId);
    if (!s) return;
    const isOpen = openCite === key;
    const h = isOpen ? CITE_H_OPEN : CITE_H;
    const cy = y;
    const btnId = `${uid}-${key}`;
    blocks.push(
      <foreignObject key={key} x={0} y={cy} width={W} height={h}>
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
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {label}
            </span>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: "var(--gold)", opacity: isOpen ? 1 : 0.55 }} />
            <span className="cite" style={{ marginLeft: 0 }}>{s.pointer}</span>
          </div>
          {isOpen && (
            <div id={`${btnId}-panel`} style={{ marginTop: 4, fontSize: 10, lineHeight: 1.4, color: "var(--text-muted)", whiteSpace: "normal" }}>
              <strong style={{ color: "var(--text)" }}>{s.reference}</strong> — {citationNote(s, lang)}
            </div>
          )}
        </button>
      </foreignObject>
    );
    y += h;
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
    const maxX = overhangPastTrunk ?? TRUNK_W;
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
        {maxX > TRUNK_W && (
          <line x1={TRUNK_W} y1={y - 4} x2={TRUNK_W} y2={y + rowH + 4} stroke={COLOR.blocked} strokeDasharray="3 3" />
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

  function branches(entries: Blocked[]) {
    blocks.push(
      <g key="hajb-branches">
        {entries.map((b, i) => {
          const by = y + i * BRANCH_ROW_H;
          const x0 = TRUNK_W * 0.45;
          const x1 = TRUNK_W; // terminates AT the trunk boundary, not past it
          return (
            <g key={b.relation}>
              <path
                d={`M ${x0} ${by - BRANCH_ROW_H / 2} L ${x1} ${by}`}
                fill="none"
                stroke={COLOR.blocked}
                strokeDasharray="4 4"
                strokeWidth={1.6}
              />
              {/* Stop mark — cue #2 of 3 (dash pattern is cue #1). */}
              <line x1={x1} y1={by - 6} x2={x1} y2={by + 6} stroke={COLOR.blocked} strokeWidth={2} />
              {/* Label sits in the reserved margin, to the right of the stop mark. */}
              <foreignObject x={x1 + 8} y={by - 8} width={MARGIN_R - 8} height={22}>
                <div style={{ ...boxStyle, alignItems: "flex-start", justifyContent: "center", height: 22, gap: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blocked)", textDecoration: "line-through" }}>
                    {b.label}
                  </span>
                  {/* Blocker's name — cue #3 of 3. */}
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                    {tr(T.blockedBy, lang)} {b.blocked_by_label}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </g>
    );
    y += entries.length * BRANCH_ROW_H + GAP_S;
  }

  // ---- Stage 1–3: gross → deductions → net (only if an estate was entered) --------
  if (hasMoney && e) {
    bar("gross", tr(T.gross, lang), formatMoney(e.gross_value, lang));
    y += GAP_XS;
    const debtsStep = result.steps.find((s) => s.step === "debts");
    if (Number(e.funeral_costs) > 0) deduction("d-funeral", tr(T.funeral, lang), e.funeral_costs);
    if (Number(e.debts) > 0) deduction("d-debts", tr(T.debts, lang), e.debts);
    if (Number(e.wasiyya) > 0) deduction("d-wasiyya", tr(T.wasiyya, lang), e.wasiyya);
    citeAnchor("cite-debts", debtsStep?.source_id, tr(T.deductions, lang));
    if (Number(e.harta_bersama_deducted) > 0) {
      const hbStep = result.steps.find((s) => s.step === "harta_bersama");
      deduction("d-hb", tr(T.hb, lang), e.harta_bersama_deducted);
      citeAnchor("cite-hb", hbStep?.source_id, tr(T.hb, lang));
    }
    bar("net", tr(T.net, lang), formatMoney(e.net_divisible, lang));
  } else {
    bar("net-frac", tr(T.net, lang), tr(T.noEstate, lang));
  }
  y += GAP_M;

  // ---- Stage 4: hajb — blocked heirs branch off and terminate ---------------------
  if (result.blocked.length > 0) {
    const hajbStep = result.steps.find((s) => s.step === "hajb");
    citeAnchor("cite-hajb", hajbStep?.source_id, tr(T.hajb, lang));
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
    citeAnchor("cite-furud", furudStep?.source_id, tr(T.furud, lang));

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
        const w = Math.max(SEG_MIN_W, float * TRUNK_W);
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
      const compWidths = shareWidths(furudGroup, TRUNK_W);
      const compSegs = furudGroup.map((s, i) => segFor(s, compWidths[i].x, compWidths[i].w));
      segRow("aul-compressed", compSegs);
    } else if (result.radd_applied) {
      const widths = shareWidths(furudGroup, TRUNK_W);
      const segs = furudGroup.map((s, i) =>
        segFor(s, widths[i].x, widths[i].w, {
          markRadd: s.category === "radd",
          markExcluded: s.category === "furud",
        })
      );
      segRow("furud-radd", segs);
    } else {
      const widths = shareWidths(furudGroup, TRUNK_W);
      const segs = furudGroup.map((s, i) => segFor(s, widths[i].x, widths[i].w));
      segRow("furud", segs);
    }
  }

  if (asabahGroup.length > 0) {
    const asabahStep = result.steps.find((s) => s.step === "asabah");
    citeAnchor("cite-asabah", asabahStep?.source_id, tr(T.asabah, lang));
    const widths = shareWidths(asabahGroup, TRUNK_W);
    const segs = asabahGroup.map((s, i) => segFor(s, widths[i].x, widths[i].w));
    segRow("asabah", segs);
  }

  // ---- Stage 8: dzawil arham — only if the pipeline actually assigned it ----------
  const dzawilGroup = awarded.filter((s) => s.category === "dzawil_arham");
  if (dzawilGroup.length > 0) {
    citeAnchor("cite-dzawil", dzawilGroup[0].source_id, tr(T.dzawil, lang));
    const widths = shareWidths(dzawilGroup, TRUNK_W);
    const segs = dzawilGroup.map((s, i) => segFor(s, widths[i].x, widths[i].w));
    segRow("dzawil", segs);
  }

  const totalH = y;

  return (
    // overflow:visible (not the .flow-wrap class's own overflow:hidden, kept for
    // DerivationFlow) — an 'aul overhang has to actually be visible past the trunk.
    <div className="flow-wrap" style={{ height: "auto", padding: 12, background: "var(--surface)", overflow: "visible" }}>
      <svg
        role="img"
        aria-hidden="true"
        viewBox={`0 0 ${W} ${totalH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        {blocks}
      </svg>

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
