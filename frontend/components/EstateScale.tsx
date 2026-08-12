"use client";

// "But what if the estate were bigger?"
//
// A curious reader had no way to try it: they could retype the gross value, but nothing
// invited it and nothing pointed out what to watch. The answer is one of the load-bearing
// facts about faraid and the app never said it — the fractions are the ruling and are
// scale-invariant; the rupiah are only that ruling multiplied by a number the family
// supplies.
//
// Letting them drag it is better than telling them, which is why this is a slider and not
// a sentence. It writes into the same estate field the form owns, so the whole result
// re-derives through the ordinary path — no separate preview, no second code path, and
// the URL keeps its usual state.

import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

/** Round steps a reader can reason about, not a linear ramp of arbitrary numbers. */
const STOPS = [
  "50000000", "100000000", "120000000", "250000000", "500000000",
  "1000000000", "2500000000", "5000000000",
];

export default function EstateScale({
  value,
  onChange,
}: {
  value: string;
  onChange: (raw: string) => void;
}) {
  const { t, lang } = useI18n();
  // Nearest stop to whatever is currently entered, so the control starts where the user is.
  const current = Math.max(
    0,
    STOPS.findIndex((s) => BigInt(s) >= BigInt(value || "0"))
  );
  const index = current === -1 ? STOPS.length - 1 : current;

  return (
    <div className="scale">
      <label className="scale-label" htmlFor="estate-scale">{t("scale_label")}</label>
      <input
        id="estate-scale"
        type="range"
        min={0}
        max={STOPS.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(STOPS[Number(e.target.value)])}
        aria-valuetext={formatMoney(STOPS[index], lang)}
      />
      <output className="scale-value" htmlFor="estate-scale">{formatMoney(STOPS[index], lang)}</output>
      <p className="scale-hint">{t("scale_hint")}</p>
    </div>
  );
}
