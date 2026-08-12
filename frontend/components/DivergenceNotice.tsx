"use client";

// Unprompted KHI-vs-Syafi'i divergence notice (PRD §4.1).
//
// The side-by-side comparison already existed, behind a checkbox below the Calculate
// button — which meant it only ever reached users who already knew the two rule sets
// diverge. Everyone else took the KHI default and was never told their case was one of
// the ones where "the Islamic answer" is not a single thing. This is the flag that says
// so, and hands them into the comparison they would otherwise never have opened.
//
// Deliberately NOT the warning treatment. Both answers are exact and both are cited; the
// disagreement is between two bodies of law, not evidence that the tool is unsure. Styling
// it as an error would teach the user to distrust the one thing telling them the truth.

import { Divergence } from "@/lib/api";
import { useI18n, rulesetShort } from "@/lib/i18n";
import { Icon } from "./ui";

export default function DivergenceNotice({
  divergence,
  onCompare,
}: {
  divergence: Divergence;
  onCompare?: () => void;
}) {
  const { t, lang } = useI18n();
  const d = divergence;

  const fill = (key: Parameters<typeof t>[0]) =>
    t(key)
      .replace("{this}", d.ruleset_label)
      .replace("{other}", d.counterpart_label);

  // Nothing to say: the two rule sets agree on the fractions and no joint property was
  // separated, so there is no second answer the user is missing.
  if (d.status === "same" && !d.harta_bersama_only) return null;

  const title =
    d.status === "differs"
      ? fill("divergence_differs_title")
      : d.status === "unsupported"
        ? fill("divergence_unsupported_title")
        : fill("divergence_hb_title");

  const body =
    d.status === "differs"
      ? fill("divergence_differs_body")
      : d.status === "unsupported"
        ? fill("divergence_unsupported_body")
        : fill("divergence_hb_body");

  return (
    <div className="divergence">
      <div className="divergence-head">
        <span className="c-ico"><Icon name="branch" size={18} /></span>
        <div className="divergence-copy">
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
        {onCompare && (
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCompare}>
            <Icon name="table" size={15} /> {t("divergence_see")}
          </button>
        )}
      </div>

      {d.rows.length > 0 && (
        <div className="divergence-rows">
          {d.rows.map((r) => (
            <div className="divergence-row" key={r.relation}>
              <span className="dv-name">{r.label}</span>
              <span className="dv-val">
                {/* Short names here: the full labels are in the heading two lines up, and
                    repeating them per row crowds out the fractions, which are the content. */}
                <span className="dv-rs">{t("divergence_th_this").replace("{rs}", rulesetShort(d.ruleset, lang))}</span>
                {/* An heir absent on one side is the loudest divergence there is — say it
                    in words rather than printing a bare 0, which reads as an amount. */}
                <b>{r.this ? r.this.text : t("divergence_none")}</b>
              </span>
              <span className="dv-val">
                <span className="dv-rs">{t("divergence_th_this").replace("{rs}", rulesetShort(d.counterpart, lang))}</span>
                <b>{r.other ? r.other.text : t("divergence_none")}</b>
              </span>
            </div>
          ))}
        </div>
      )}

      {d.status === "unsupported" && d.detail && (
        <div className="divergence-detail">{d.detail}</div>
      )}
    </div>
  );
}
