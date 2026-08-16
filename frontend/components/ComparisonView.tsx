"use client";

import { ComparisonEntry } from "@/lib/api";
import { useI18n, rulesetLabel } from "@/lib/i18n";
import { Icon } from "./ui";
import ResultView from "./ResultView";

// Side-by-side rule-set comparison (PRD §4.1). Each column is either a full derivation
// or a clear "not supported under this school" message.

/**
 * The largest net_divisible among the computed columns (DESIGN.md §7: "Both flows share
 * one scale. Different scales would make the comparison a lie."). All compared columns
 * run the SAME request — same gross value, same deductions — so only KHI's harta-bersama
 * separation can actually make net_divisible diverge between them; this is the reference
 * every EstateFlow scales its net-divisible-onward stages against instead of each column
 * independently treating its own amount as 100% of the trunk.
 */
function sharedScale(entries: ComparisonEntry[]): string | null {
  let max: string | null = null;
  for (const entry of entries) {
    const net = entry.ok ? entry.result?.estate?.net_divisible : undefined;
    if (net && (max == null || Number(net) > Number(max))) max = net;
  }
  return max;
}

/**
 * DESIGN.md §7: "they diverge at a specific gold line, and everything above that line is
 * identical." The engine's own `Step.step` key of the first stage whose content differs
 * between two fully-computed columns — comparing `step` (which stage) and `detail` (the
 * derivation prose already carries the computed fractions/amounts, so a numeric
 * difference shows up as a text difference without re-deriving anything). Only defined
 * when BOTH sides actually computed a result: a column that raised entirely has no step
 * list to align against, and the existing "not computable" box already says so.
 */
function findDivergentStep(entries: ComparisonEntry[]): string | null {
  const results = entries.filter((e) => e.ok && e.result).map((e) => e.result!);
  if (results.length < 2) return null;
  const [a, b] = results;
  const len = Math.max(a.steps.length, b.steps.length);
  for (let i = 0; i < len; i++) {
    const sa = a.steps[i];
    const sb = b.steps[i];
    if (!sa || !sb) return (sa ?? sb)?.step ?? null; // one ran out of steps first
    if (sa.step !== sb.step || sa.detail !== sb.detail) return sa.step;
  }
  return null;
}

export default function ComparisonView({ entries }: { entries: ComparisonEntry[] }) {
  const { lang, t } = useI18n();
  const scaleMaxNet = sharedScale(entries);
  const highlightStep = findDivergentStep(entries);
  return (
    <div className="compare-grid">
      {entries.map((entry) => (
        <div className="compare-col" key={entry.ruleset}>
          <div className="compare-col-head">
            <Icon name="book" size={16} className="ico" />
            <h3>{rulesetLabel(entry.ruleset, lang)}</h3>
          </div>
          {entry.ok && entry.result ? (
            <ResultView result={entry.result} scaleMaxNet={scaleMaxNet} highlightStep={highlightStep} />
          ) : (
            <div className="error-box">
              <Icon name="ban" size={18} />
              <div>
                <strong>{t("not_computable")}</strong>
                <div className="small" style={{ marginTop: "var(--sp-1)" }}>{entry.detail}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
