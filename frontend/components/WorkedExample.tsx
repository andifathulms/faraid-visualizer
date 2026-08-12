"use client";

// One complete case, worked end to end, readable before touching any control.
//
// The empty pane used to show a fragment — two share rows and one step — which taught the
// VOCABULARY of the output but not the PROCESS. So a newcomer's only route to
// understanding the thing this app exists to explain was: fill in a form about their own
// dead relative, accept a legal disclaimer, and read a result.
//
// This is the same case the form is pre-filled with, including the estate, so pressing
// Calculate reproduces these exact figures. Reading it and doing it agree — which is why
// the numbers are hardcoded here rather than computed: this has to render before Pyodide
// has finished downloading, which is the entire window in which a first-time visitor
// decides whether the tool is worth waiting for.
//
// The figures are checked against the engine in
// backend/faraid_web/tests/test_worked_example.py, so the example cannot drift from what
// the app actually computes.

import { CalculationRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

/** The case, as the form holds it. Kept beside the prose it illustrates. */
export const EXAMPLE_CASE: CalculationRequest = {
  heirs: { husband: true, sons: 2, daughters: 1 },
  ruleset: "khi",
  estate: { gross_value: "120000000", debts: "20000000" },
};

export default function WorkedExample() {
  const { t } = useI18n();

  // Each stage: what happened, the arithmetic, and the rule it came from. The citation is
  // a plain visible chip, not a tooltip — it has to survive touch and be searchable.
  const stages: { title: string; body: string; cite?: string }[] = [
    { title: t("we_s1_title"), body: t("we_s1_body"), cite: "KHI Pasal 175" },
    { title: t("we_s2_title"), body: t("we_s2_body") },
    { title: t("we_s3_title"), body: t("we_s3_body"), cite: "QS 4:12" },
    { title: t("we_s4_title"), body: t("we_s4_body"), cite: "QS 4:11" },
  ];

  return (
    <section className="worked" aria-labelledby="worked-heading">
      <h3 id="worked-heading">{t("we_heading")}</h3>
      <p className="worked-lede">{t("we_lede")}</p>

      <ol className="worked-stages">
        {stages.map((s, i) => (
          <li key={i}>
            <div className="ws-head">
              <span className="ws-n" aria-hidden="true">{i + 1}</span>
              <span className="ws-title">{s.title}</span>
              {s.cite && <span className="cite"><Icon name="book" size={11} /> {s.cite}</span>}
            </div>
            <p className="ws-body">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="worked-result">
        <div className="wr-head">{t("we_result_title")}</div>
        <ul>
          <li><span>{t("we_r_husband")}</span><b>Rp 25.000.000</b></li>
          <li><span>{t("we_r_sons")}</span><b>Rp 60.000.000</b></li>
          <li><span>{t("we_r_daughter")}</span><b>Rp 15.000.000</b></li>
        </ul>
      </div>

      {/* Honest about what this example leaves out, inline, where it is read. */}
      <p className="worked-caveat">{t("we_caveat")}</p>
      <p className="worked-try">{t("we_try")}</p>
    </section>
  );
}
