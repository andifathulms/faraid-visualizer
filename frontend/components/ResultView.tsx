"use client";

import { useState } from "react";
import { CalculationResult, citationNote, HeirsInput, SourceCitation, Step, Working } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { centsToMoney, toCents } from "@/lib/format";
import { describeHeirs } from "@/lib/summary";
import { Icon } from "./ui";
import CoverageGaps from "./CoverageGaps";
import EstateFlow from "./EstateFlow";

// Data text (labels, categories, reasons, step titles, notes, disclaimer) is server-
// localized; this component supplies static UI chrome + the visual composition.

function Citation({ id, sources }: { id: string; sources: Record<string, SourceCitation> }) {
  const { lang } = useI18n();
  const src = sources[id];
  if (!src) return null;
  const note = citationNote(src, lang);
  return (
    <span className="cite" title={`${src.reference}${note ? " — " + note : ""}`}>
      <Icon name="book" size={11} /> {src.pointer}
    </span>
  );
}

/**
 * An omitted estate serializes as a ZERO estate rather than null (see
 * faraid_web/tests/test_serialize.py), so `amount` is "0.00" and truthy. Money is only
 * meaningful when the user actually entered something to divide.
 */
function hasMoney(result: CalculationResult): boolean {
  const net = toCents(result.estate?.net_divisible);
  return net !== null && net > 0n;
}

/**
 * Each heir's amount is quantized to the cent independently and the engine does NOT
 * redistribute the remainder — assigning a leftover cent is a fiqh decision, not a
 * rounding convention. So the awarded amounts can sum to a cent or two off the divisible
 * estate. State that plainly rather than letting it sit there unexplained.
 */
function RoundingNote({ result }: { result: CalculationResult }) {
  const { t, lang } = useI18n();
  const net = toCents(result.estate?.net_divisible);
  if (net === null || net <= 0n) return null;

  let sum = 0n;
  for (const s of result.shares) {
    if (s.category === "harta_bersama") continue; // pre-faraid, not part of the division
    const c = toCents(s.amount);
    if (c === null) return null; // unparseable: say nothing rather than something wrong
    sum += c;
  }

  const diff = sum - net;
  if (diff === 0n) return null;

  return (
    <div className="rounding-note">
      <span className="ico"><Icon name="info" size={14} /></span>
      <span>{t("rounding_note").replace("{diff}", centsToMoney(diff < 0n ? -diff : diff, lang))}</span>
    </div>
  );
}

/**
 * The ordered pipeline, in plain language, for Personal mode.
 *
 * Professional mode gets the full timeline with every intermediate value. Personal mode
 * previously got nothing at all — so the audience PRD §1 is actually written about (a
 * family who has to bring a number back to relatives who will contest it) saw only the
 * answer. This is the same steps the engine emitted, rendered as a short numbered
 * narrative with each step's citations attached, so the chain is followable without
 * becoming a spreadsheet.
 */
function PlainPipeline({ result }: { result: CalculationResult }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (result.steps.length === 0) return null;

  return (
    <div className="plain-pipeline">
      <button
        className="coverage-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="chevron" size={14} className={open ? "rot" : undefined} />
        {t("pipeline_toggle")}
      </button>
      {open && (
        <>
          <p className="pipeline-lede">{t("pipeline_lede")}</p>
          <ol className="pipeline-list">
            {result.steps.map((st, i) => (
              <li key={i}>
                <span className="pl-title">
                  {st.title}
                  {stepSources(st).map((sid) => (
                    <Citation key={sid} id={sid} sources={result.sources} />
                  ))}
                </span>
                {st.detail && <span className="pl-detail">{st.detail}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * The pokok masalah as working rather than as a label.
 *
 * A list of fractions and a badge reading "pokok masalah 6" is the one representation of
 * a faraid result a trained user cannot check against their own paper — what they check
 * is the siham column and its sum against the base. It also makes 'aul legible: the
 * fraction list makes 6→7 look like everyone shrank, while the siham column shows each
 * heir's parts unchanged and the denominator moving, which is the whole content of 'aul.
 *
 * Every number here is computed in faraid_web/working.py, not in this component. When the
 * engine cannot express the shares exactly over the base the payload carries null and
 * this renders nothing — a missing table is correct, rounded integers would not be.
 */
function WorkingTable({ working }: { working: Working }) {
  const { t } = useI18n();
  const anyGroups = working.rows.some((r) => r.count > 1);
  const anyFractionalPerHead = working.rows.some(
    (r) => r.count > 1 && r.per_head_siham.denominator !== 1
  );

  return (
    <div>
      <div className="res-section-title">
        <span className="ico"><Icon name="table" size={16} /></span>
        {t("working_title")}
        <span className="badge badge-soft">{t("pokok_masalah")} {working.base}</span>
      </div>
      <p className="small muted" style={{ marginBottom: "var(--sp-2)" }}>{t("working_hint")}</p>
      {/* Two terms this table cannot be read without. Visible text, beside the table
          that uses them. */}
      <dl className="defs">
        <div><dt>{t("pokok_masalah")}</dt><dd>{t("def_pokok_masalah")}</dd></div>
        <div><dt>{t("th_siham")}</dt><dd>{t("def_siham")}</dd></div>
      </dl>

      <div className="working-scroll">
        <table className="working">
          {/* The visible heading is a div outside the table, so without this a screen
              reader reaches an uncaptioned grid of numbers. Visually hidden rather than
              shown: the heading above already says it sighted. */}
          <caption className="sr-only">
            {t("working_title")} — {t("pokok_masalah")} {working.base}
          </caption>
          <thead>
            <tr>
              <th>{t("th_heir")}</th>
              <th className="num">{t("th_share")}</th>
              <th className="num">{t("th_siham")}</th>
              {anyGroups && <th className="num">{t("th_perhead_siham")}</th>}
            </tr>
          </thead>
          <tbody>
            {working.rows.map((r, i) => (
              <tr key={i}>
                <td>
                  {r.label}
                  {r.count > 1 && <span className="count-tag">×{r.count}</span>}
                </td>
                <td className="num">{r.share.text}</td>
                <td className="num siham">{r.siham}</td>
                {anyGroups && (
                  <td className="num">{r.count > 1 ? r.per_head_siham.text : "—"}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={working.balanced ? "" : "short"}>
              <td>{t("working_total")}</td>
              <td className="num" />
              <td className="num siham">
                {working.total_siham} / {working.base}
              </td>
              {anyGroups && <td className="num" />}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="working-notes">
        {working.aul_applied && <p className="term-def">{t("def_aul")}</p>}
        {working.radd_applied && <p className="term-def">{t("def_radd")}</p>}
        {working.aul_applied && working.aul_base !== null && (
          <p>
            {t("working_aul_note")
              .replace("{base}", String(working.pokok_masalah))
              .replace("{aul}", String(working.aul_base))}
          </p>
        )}
        {working.radd_applied && (
          <p>{t("working_radd_note").replace("{base}", String(working.base))}</p>
        )}
        {!working.balanced && <p>{t("working_unbalanced_note")}</p>}
        {anyFractionalPerHead && <p>{t("working_tashih_note")}</p>}
      </div>
    </div>
  );
}

/**
 * Every citation a step applied. `source_id` is set only when the step used exactly one
 * rule; `data.source_ids` carries the full set, because hajb and furud each fire a
 * different rule per heir.
 */
function stepSources(step: Step): string[] {
  const many = step.data?.source_ids;
  if (Array.isArray(many) && many.length) return many as string[];
  return step.source_id ? [step.source_id] : [];
}

/** What produced these numbers — visible without scrolling back to the form. */
export function InputSummary({ heirs }: { heirs: HeirsInput }) {
  const { t, lang } = useI18n();
  const chips = describeHeirs(heirs, lang);
  if (chips.length === 0) return null;
  return (
    <div className="input-chips">
      <span className="input-chips-label">{t("inputs_used")}:</span>
      {chips.map((c) => (
        <span className="input-chip" key={c.id}>
          {c.label}
          {c.count > 1 && <b>×{c.count}</b>}
        </span>
      ))}
    </div>
  );
}

export default function ResultView({ result }: { result: CalculationResult }) {
  const { t, lang } = useI18n();
  const professional = result.mode === "professional";
  const e = result.estate;
  const showMoney = hasMoney(result);
  return (
    <div className="stack gap-20">
      {result.beta && (
        <div className="callout callout-warn">
          <span className="c-ico"><Icon name="alert" size={18} /></span>
          <span><b>BETA</b> — {t("beta_warn")}</span>
        </div>
      )}

      {/* The estate descending through the pipeline, splitting — DESIGN.md §5. Absorbs
          what used to be three separate half-pictures of the same quantity: the
          summary/proportion bar, the estate-deduction sentence, and the per-share list
          with its "why?" disclosures (the gold rule-lines carry that citation now). */}
      <EstateFlow input={{ kind: "result", result }} lang={lang} />

      {/* An estate was entered but nothing survives the deductions, so the shares carry no
          rupiah. Say why rather than quietly rendering fractions only — the usual cause is
          an amount typed into the wrong field. */}
      {!showMoney && e && (toCents(e.harta_bersama_deducted) ?? 0n) > 0n && (
        <div className="callout callout-warn">
          <span className="c-ico"><Icon name="alert" size={17} /></span>
          <span>{t("no_divisible_estate")}</span>
        </div>
      )}

      {showMoney && <RoundingNote result={result} />}

      {/* Always present, never behind a mode or a toggle (DESIGN.md §1, §4) — this is
          the verification artifact a trained user actually checks a result against. */}
      {result.working && <WorkingTable working={result.working} />}

      {result.blocked.length > 0 && (
        <div>
          <div className="res-section-title"><span className="ico" style={{ color: "var(--blocked)" }}><Icon name="ban" size={16} /></span>{t("blocked_title")}</div>
          <p className="term-def">{t("def_hajb")}</p>
          <div className="blocked-list">
            {result.blocked.map((b, i) => (
              <div className="blocked-item" key={i}>
                <span className="b-name">{b.label}{b.count > 1 ? ` ×${b.count}` : ""}</span>
                <span className="b-why">{b.reason} <Citation id={b.source_id} sources={result.sources} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The pipeline, for the mode that is NOT shown the timeline. Which rules ran, in
          order, with the citation each one applied — the derivation as a short narrative
          rather than a table of intermediate values. */}
      {!professional && <PlainPipeline result={result} />}

      {professional && (
        <div>
          <div className="res-section-title"><span className="ico"><Icon name="layers" size={16} /></span>{t("steps_title")}</div>
          <div className="timeline">
            {result.steps.map((st, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-rail">
                  <div className="tl-dot">{i + 1}</div>
                  {i < result.steps.length - 1 && <div className="tl-line" />}
                </div>
                <div className="tl-body">
                  <div className="tl-title">
                    {st.title}
                    {/* A step can apply several rules at once — a furud step assigns a
                        different basis to each heir — so every source it used is cited
                        here, at the point of application, rather than one being picked
                        arbitrarily or the whole step going uncited. */}
                    {stepSources(st).map((sid) => (
                      <Citation key={sid} id={sid} sources={result.sources} />
                    ))}
                  </div>
                  {st.detail && <div className="tl-detail">{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.notes.length > 0 && (
        <div>
          <div className="res-section-title"><span className="ico"><Icon name="info" size={16} /></span>{t("notes_title")}</div>
          <div className="note-stack">
            {result.notes.map((n, i) => (
              <div className="callout callout-info" key={i}>
                <span className="c-ico"><Icon name="info" size={16} /></span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Immediately above the disclaimer: both answer "how far does this go", and the
          specific limits belong beside the general one rather than buried further up. */}
      <CoverageGaps gaps={result.coverage_gaps} />

      <div className="callout callout-warn">
        <span className="c-ico"><Icon name="alert" size={17} /></span>
        <span>{result.disclaimer}</span>
      </div>
    </div>
  );
}
