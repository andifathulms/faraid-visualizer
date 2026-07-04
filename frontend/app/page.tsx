"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculate,
  CalculationError,
  CalculationRequest,
  CalculationResult,
  compare,
  ComparisonEntry,
  EstateInput,
  fetchPdf,
  HeirsInput,
  Mode,
  Ruleset,
} from "@/lib/api";
import { useI18n, rulesetLabel, Lang } from "@/lib/i18n";
import HeirForm from "@/components/HeirForm";
import ResultView from "@/components/ResultView";
import DerivationFlow from "@/components/DerivationFlow";
import ComparisonView from "@/components/ComparisonView";
import DisclaimerModal from "@/components/DisclaimerModal";

const RULESETS: Ruleset[] = ["khi", "syafii", "hanafi", "maliki", "hanbali"];

function cleanEstate(e: EstateInput): EstateInput | undefined {
  const entries = Object.entries(e).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export default function Home() {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<Mode>("personal");
  const [ruleset, setRuleset] = useState<Ruleset>("khi");
  const [heirs, setHeirs] = useState<HeirsInput>({ husband: true, sons: 2, daughters: 1 });
  const [estate, setEstate] = useState<EstateInput>({});
  const [hartaBersama, setHartaBersama] = useState(false);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonEntry[] | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [pendingCalc, setPendingCalc] = useState(false);
  const [view, setView] = useState<"table" | "diagram">("table");
  const [exportingPdf, setExportingPdf] = useState(false);

  function buildRequest(): CalculationRequest {
    return {
      heirs,
      ruleset,
      apply_harta_bersama: ruleset === "khi" && hartaBersama,
      estate: cleanEstate(estate),
    };
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setError(null);
    try {
      const blob = await fetchPdf(buildRequest(), lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "perhitungan-faraid.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof CalculationError ? err.message : t("preparing"));
    } finally {
      setExportingPdf(false);
    }
  }

  async function runCalc() {
    setLoading(true);
    setError(null);
    const req: CalculationRequest = buildRequest();
    try {
      if (compareMode) {
        const entries = await compare(req, ["khi", "syafii"], mode, lang);
        setComparison(entries);
        setResult(null);
      } else {
        const res = await calculate(req, mode, lang);
        setResult(res);
        setComparison(null);
      }
    } catch (err) {
      const message =
        err instanceof CalculationError ? err.message : t("server_error");
      setError(message);
      setResult(null);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit() {
    if (!disclaimerAccepted) {
      setPendingCalc(true); // gate first calculation behind the disclaimer (PRD §7)
      return;
    }
    runCalc();
  }

  // Re-fetch when the language changes so the server-localized derivation text updates
  // (the API is the single source of truth for reasons/labels/disclaimer).
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (disclaimerAccepted && (result || comparison)) runCalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>{t("app_title")}</h1>
          <div className="subtitle">{t("app_subtitle")}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="toggle-group" role="tablist" aria-label="Language">
            {(["id", "en"] as Lang[]).map((l) => (
              <button key={l} className={lang === l ? "active" : ""} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="toggle-group" role="tablist" aria-label="Mode">
            <button className={mode === "personal" ? "active" : ""} onClick={() => setMode("personal")}>
              {t("mode_personal")}
            </button>
            <button className={mode === "professional" ? "active" : ""} onClick={() => setMode("professional")}>
              {t("mode_professional")}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{t("heirs_card_title")}</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>{t("legal_basis")}</label>
          <select
            value={ruleset}
            onChange={(e) => {
              const r = e.target.value as Ruleset;
              setRuleset(r);
              if (r !== "khi") {
                setHartaBersama(false);
                setHeirs({ ...heirs, representatives: [] });
              }
            }}
          >
            {RULESETS.map((r) => (
              <option key={r} value={r}>
                {rulesetLabel(r, lang)}
              </option>
            ))}
          </select>
        </div>

        <HeirForm
          heirs={heirs}
          setHeirs={setHeirs}
          estate={estate}
          setEstate={setEstate}
          ruleset={ruleset}
          hartaBersama={hartaBersama}
          setHartaBersama={setHartaBersama}
        />

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button className="btn" onClick={onSubmit} disabled={loading}>
            {loading ? t("calculating") : compareMode ? t("calc_compare") : t("calc")}
          </button>
          <label className="checkbox">
            <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
            {t("compare_toggle")}
          </label>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="error-box">
            <strong>{t("cannot_calc")}</strong> {error}
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="header" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{t("result")} — {rulesetLabel(result.ruleset, lang)}</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="toggle-group" role="tablist" aria-label="View">
                <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
                  {t("view_table")}
                </button>
                <button className={view === "diagram" ? "active" : ""} onClick={() => setView("diagram")}>
                  {t("view_diagram")}
                </button>
              </div>
              {result.mode === "professional" && (
                <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
                  {exportingPdf ? t("preparing") : t("export_pdf")}
                </button>
              )}
            </div>
          </div>
          {view === "table" ? (
            <ResultView result={result} />
          ) : (
            <>
              <DerivationFlow result={result} />
              <div className="disclaimer" style={{ marginTop: 16 }}>{result.disclaimer}</div>
            </>
          )}
        </div>
      )}

      {comparison && (
        <div className="card">
          <h2>{t("comparison_title")}</h2>
          <ComparisonView entries={comparison} />
        </div>
      )}

      {pendingCalc && (
        <DisclaimerModal
          onAccept={() => {
            setDisclaimerAccepted(true);
            setPendingCalc(false);
            runCalc();
          }}
        />
      )}
    </div>
  );
}
