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
import { ThemeToggle } from "@/lib/theme";
import HeirForm from "@/components/HeirForm";
import ResultView from "@/components/ResultView";
import DerivationFlow from "@/components/DerivationFlow";
import ComparisonView from "@/components/ComparisonView";
import DisclaimerModal from "@/components/DisclaimerModal";
import EngineStatus from "@/components/EngineStatus";
import { preloadEngine } from "@/lib/engine";
import { Icon, Segmented } from "@/components/ui";

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
    const req = buildRequest();
    try {
      if (compareMode) {
        setComparison(await compare(req, ["khi", "syafii"], mode, lang));
        setResult(null);
      } else {
        setResult(await calculate(req, mode, lang));
        setComparison(null);
      }
    } catch (err) {
      setError(err instanceof CalculationError ? err.message : t("server_error"));
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

  // Start downloading the WebAssembly engine immediately. Entering heirs takes far
  // longer than the download, so by the time Calculate is pressed it is usually ready.
  useEffect(() => {
    void preloadEngine().catch(() => {
      /* surfaced by <EngineStatus />; a failure here must not break the form */
    });
  }, []);

  // Recompute when the language changes so the localized derivation text updates.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (disclaimerAccepted && (result || comparison)) runCalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const hasResult = !!result || !!comparison;

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="brand">
            <div className="brand-mark"><Icon name="scale" size={22} /></div>
            <div>
              <div className="brand-name">Faraid<b>Visualizer</b></div>
              <div className="brand-tag">{t("app_tagline")}</div>
            </div>
          </div>
          <div className="row gap-10">
            <ThemeToggle />
            <Segmented<Lang>
              ariaLabel="Language"
              value={lang}
              onChange={setLang}
              options={[
                { value: "id", label: "ID" },
                { value: "en", label: "EN" },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="layout">
        {/* ---- Input pane ---- */}
        <aside className="pane-form">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>
              <Icon name="users" size={18} /> {t("form_title")}
            </div>

            <Segmented<Mode>
              block
              ariaLabel="Mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "personal", label: t("mode_personal") },
                { value: "professional", label: t("mode_professional") },
              ]}
            />
            <p className="small muted" style={{ marginTop: 8 }}>
              {mode === "professional" ? t("mode_hint_professional") : t("mode_hint_personal")}
            </p>

            <div className="divider" />

            <div className="field">
              <span className="field-label">{t("legal_basis")}</span>
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
                  <option key={r} value={r}>{rulesetLabel(r, lang)}</option>
                ))}
              </select>
            </div>

            <HeirForm
              heirs={heirs} setHeirs={setHeirs} estate={estate} setEstate={setEstate}
              ruleset={ruleset} hartaBersama={hartaBersama} setHartaBersama={setHartaBersama}
            />

            <div className="divider" />
            <EngineStatus />
            <button className="btn btn-lg" onClick={onSubmit} disabled={loading}>
              {loading ? t("calculating") : (<><Icon name="scale" size={17} /> {compareMode ? t("calc_compare") : t("calc")}</>)}
            </button>
            <label className="check-line" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
              {t("compare_toggle")}
            </label>
          </div>
        </aside>

        {/* ---- Result pane ---- */}
        <section className="pane-result">
          {error ? (
            <div className="card card-pad">
              <div className="error-box">
                <Icon name="alert" size={18} />
                <div><strong>{t("cannot_calc")}</strong><div className="small" style={{ marginTop: 4 }}>{error}</div></div>
              </div>
            </div>
          ) : loading ? (
            <div className="card card-pad">
              <div className="skeleton" style={{ height: 22, width: "40%", marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 34, width: "100%", marginBottom: 20 }} />
              {[...Array(4)].map((_, i) => (
                <div className="skeleton" key={i} style={{ height: 58, width: "100%", marginBottom: 8 }} />
              ))}
            </div>
          ) : comparison ? (
            <div className="card card-pad">
              <div className="card-title" style={{ marginBottom: 16 }}><Icon name="book" size={18} /> {t("comparison_title")}</div>
              <ComparisonView entries={comparison} />
            </div>
          ) : result ? (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <Icon name="scale" size={18} /> {t("result")}
                  <span className="badge badge-primary" style={{ marginLeft: 2 }}>{rulesetLabel(result.ruleset, lang)}</span>
                </div>
                <div className="result-toolbar">
                  <Segmented<"table" | "diagram">
                    ariaLabel="View" value={view} onChange={setView}
                    options={[
                      { value: "table", label: <><Icon name="table" size={14} /> {t("view_table")}</> },
                      { value: "diagram", label: <><Icon name="sitemap" size={14} /> {t("view_diagram")}</> },
                    ]}
                  />
                  {result.mode === "professional" && (
                    <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
                      <Icon name="download" size={16} /> {exportingPdf ? t("pdf_preparing") : t("export_pdf")}
                    </button>
                  )}
                </div>
              </div>
              <div className="card-pad">
                {view === "table" ? (
                  <ResultView result={result} />
                ) : (
                  <>
                    <DerivationFlow result={result} />
                    <div className="callout callout-warn" style={{ marginTop: 16 }}>
                      <span className="c-ico"><Icon name="alert" size={17} /></span>
                      <span>{result.disclaimer}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-emblem"><Icon name="scale" size={38} /></div>
                <h3>{t("empty_title")}</h3>
                <p>{t("empty_body")}</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {pendingCalc && (
        <DisclaimerModal
          onAccept={() => {
            setDisclaimerAccepted(true);
            setPendingCalc(false);
            runCalc();
          }}
        />
      )}
    </>
  );
}
