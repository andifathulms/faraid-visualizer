"use client";

// Two further cases, worked, as ordinary page content.
//
// Reasons this exists, in order of weight:
//
// 1. The landing page held 414 words of crawlable text, and the app's deepest content —
//    the derivation — is behind interaction, so a search engine never saw it. These are
//    static prose about the exact questions people type ("pembagian warisan istri dan
//    anak", "warisan anak perempuan tunggal").
// 2. One example teaches one shape. Case B is the commonest real Indonesian estate;
//    case C shows the father taking a fixed share AND the leftover, which the primary
//    example does not demonstrate at all.
//
// Every figure is the engine's own output, pinned in
// backend/faraid_web/tests/test_more_examples.py. Hardcoded here for the same reason as
// the primary example: it must render before Pyodide finishes downloading.

import { CalculationRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

/** The cases, exactly as the tests pin them. */
export const EXTRA_EXAMPLES: CalculationRequest[] = [
  {
    heirs: { wives: 1, sons: 1, daughters: 2 },
    ruleset: "khi",
    estate: { gross_value: "200000000" },
  },
  {
    heirs: { father: true, mother: true, daughters: 1 },
    ruleset: "khi",
    estate: { gross_value: "120000000" },
  },
];

export default function MoreExamples() {
  const { t } = useI18n();

  const cases = [
    {
      id: "b",
      title: t("ex_b_title"),
      lede: t("ex_b_lede"),
      steps: [
        { body: t("ex_b_s1"), cite: "KHI Pasal 180" },
        { body: t("ex_b_s2"), cite: "QS 4:11" },
      ],
      rows: [
        { who: t("ex_b_r1"), amount: "Rp 25.000.000" },
        { who: t("ex_b_r2"), amount: "Rp 87.500.000" },
        { who: t("ex_b_r3"), amount: "Rp 87.500.000" },
      ],
    },
    {
      id: "c",
      title: t("ex_c_title"),
      lede: t("ex_c_lede"),
      steps: [
        { body: t("ex_c_s1"), cite: "KHI Pasal 176" },
        { body: t("ex_c_s2"), cite: "KHI Pasal 178" },
        { body: t("ex_c_s3"), cite: "KHI Pasal 177" },
      ],
      rows: [
        { who: t("ex_c_r1"), amount: "Rp 60.000.000" },
        { who: t("ex_c_r2"), amount: "Rp 40.000.000" },
        { who: t("ex_c_r3"), amount: "Rp 20.000.000" },
      ],
    },
  ];

  return (
    <section className="more-examples" aria-labelledby="more-examples-heading">
      <div className="more-examples-inner">
        <h2 id="more-examples-heading">{t("ex_heading")}</h2>
        <p className="me-lede">{t("ex_lede")}</p>

        <div className="me-grid">
          {cases.map((c) => (
            <article className="me-case" key={c.id}>
              <h3>{c.title}</h3>
              <p className="me-case-lede">{c.lede}</p>
              <ul className="me-steps">
                {c.steps.map((s, i) => (
                  <li key={i}>
                    {s.body}
                    <span className="cite"><Icon name="book" size={11} /> {s.cite}</span>
                  </li>
                ))}
              </ul>
              <ul className="me-result">
                {c.rows.map((r, i) => (
                  <li key={i}><span>{r.who}</span><b>{r.amount}</b></li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Same honesty as the primary example: say what these leave out. */}
        <p className="me-caveat">{t("ex_caveat")}</p>
      </div>
    </section>
  );
}
