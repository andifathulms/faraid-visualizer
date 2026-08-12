"use client";

// Announces that the result changed, for users who cannot see it change.
//
// The app live-recalculates on a 250 ms debounce, so a sighted user watches the pane dim
// and refresh. Before this there were ZERO live regions in the document — measured — so a
// screen reader user adjusted a stepper and received no indication whatsoever that the
// answer had moved, and no reason to go back and re-read it.
//
// Deliberately a summary, not the pane. Marking the whole result region aria-live would
// re-read the entire derivation on every keystroke, which is worse than the silence it
// replaces. This says the answer moved and gives its shape; the detail is in the pane,
// which the user can navigate to when they choose.
//
// role="status" (= aria-live="polite" + aria-atomic) rather than a bare aria-live div:
// it is the native mapping for a non-urgent status message and is what EngineStatus
// already uses for the engine boot notice.

import { useEffect, useState } from "react";
import { CalculationError, CalculationResult, ComparisonEntry } from "@/lib/api";
import { useI18n, rulesetLabel } from "@/lib/i18n";

export default function ResultAnnouncer({
  result,
  comparison,
  error,
  busy,
}: {
  result: CalculationResult | null;
  comparison: ComparisonEntry[] | null;
  error: CalculationError | string | null;
  busy: "idle" | "initial" | "live";
}) {
  const { t, lang } = useI18n();
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Only speak settled states. Announcing mid-flight would interrupt the user with
    // "calculating" on every keystroke of a debounced edit.
    if (busy !== "idle") return;

    if (error) {
      const msg = error instanceof CalculationError ? error.message : String(error);
      setMessage(t("announce_error").replace("{msg}", msg));
      return;
    }
    if (comparison) {
      setMessage(t("announce_comparison").replace("{n}", String(comparison.length)));
      return;
    }
    if (result) {
      const heirs = result.shares.filter((s) => s.category !== "harta_bersama").length;
      setMessage(
        t("announce_result")
          .replace("{heirs}", String(heirs))
          .replace("{base}", String(result.working?.base ?? result.pokok_masalah))
          .replace("{ruleset}", rulesetLabel(result.ruleset, lang))
      );
      return;
    }
    setMessage("");
  }, [result, comparison, error, busy, t, lang]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
