"use client";

import { ComparisonEntry } from "@/lib/api";
import { useI18n, rulesetLabel } from "@/lib/i18n";
import { Icon } from "./ui";
import ResultView from "./ResultView";

// Side-by-side rule-set comparison (PRD §4.1). Each column is either a full derivation
// or a clear "not supported under this school" message.

export default function ComparisonView({ entries }: { entries: ComparisonEntry[] }) {
  const { lang, t } = useI18n();
  return (
    <div className="compare-grid">
      {entries.map((entry) => (
        <div className="compare-col" key={entry.ruleset}>
          <div className="compare-col-head">
            <Icon name="book" size={16} className="ico" />
            <h3>{rulesetLabel(entry.ruleset, lang)}</h3>
          </div>
          {entry.ok && entry.result ? (
            <ResultView result={entry.result} />
          ) : (
            <div className="error-box">
              <Icon name="ban" size={18} />
              <div>
                <strong>{t("not_computable")}</strong>
                <div className="small" style={{ marginTop: 4 }}>{entry.detail}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
