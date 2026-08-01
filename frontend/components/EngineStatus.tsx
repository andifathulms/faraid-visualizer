"use client";

// Boot status for the in-browser rule engine.
//
// The engine is real CPython compiled to WebAssembly (~13 MB), so a first visit has a
// genuine multi-second download. Showing an unexplained spinner for that long reads as a
// broken page; this says what is happening and why it is worth waiting for. Once cached
// the component renders nothing, which is the common case on repeat visits.

import { useEffect, useState } from "react";
import { EngineState, preloadEngine, subscribeEngine } from "@/lib/engine";
import { useI18n } from "@/lib/i18n";

export default function EngineStatus() {
  const { t } = useI18n();
  const [state, setState] = useState<EngineState>({ stage: "idle" });

  useEffect(() => subscribeEngine(setState), []);

  if (state.stage === "ready" || state.stage === "idle") return null;

  if (state.stage === "error") {
    return (
      <div className="engine-status engine-status-error" role="alert">
        <div>
          <strong>{t("engine_error")}</strong>
          {state.error ? <div className="small muted">{state.error}</div> : null}
        </div>
        <button className="btn btn-sm" onClick={() => void preloadEngine().catch(() => {})}>
          {t("engine_retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="engine-status" role="status" aria-live="polite">
      <span className="engine-spinner" aria-hidden="true" />
      <div>
        <div>{t(state.stage === "downloading" ? "engine_downloading" : "engine_starting")}</div>
        <div className="small muted">{t("engine_hint")}</div>
      </div>
    </div>
  );
}
