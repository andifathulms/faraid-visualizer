"use client";

import { ComparisonEntry } from "@/lib/api";
import { useI18n, rulesetLabel } from "@/lib/i18n";
import ResultView from "./ResultView";

// Side-by-side rule-set comparison (PRD §4.1). Each column is either a full derivation
// or a clear "not supported under this school" message.

export default function ComparisonView({ entries }: { entries: ComparisonEntry[] }) {
  const { lang, t } = useI18n();
  return (
    <div className="compare-grid">
      {entries.map((entry) => (
        <div className="compare-col" key={entry.ruleset}>
          <h3 style={{ marginTop: 0 }}>{rulesetLabel(entry.ruleset, lang)}</h3>
          {entry.ok && entry.result ? (
            <ResultView result={entry.result} />
          ) : (
            <div className="error-box">
              <strong>{t("not_computable")}</strong>
              <div className="small" style={{ marginTop: 6 }}>{entry.detail}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
