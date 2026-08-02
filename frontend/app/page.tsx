"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import ResultView, { InputSummary } from "@/components/ResultView";
import DerivationFlow from "@/components/DerivationFlow";
import ComparisonView from "@/components/ComparisonView";
import DisclaimerModal from "@/components/DisclaimerModal";
import EngineStatus from "@/components/EngineStatus";
import { preloadEngine } from "@/lib/engine";
import { Icon, Segmented } from "@/components/ui";
import { clearStateFromUrl, currentShareUrl, decodeState, writeStateToUrl, type ShareableState } from "@/lib/urlstate";
import { totalHeirs } from "@/lib/summary";

const RULESETS: Ruleset[] = ["khi", "syafii", "hanafi", "maliki", "hanbali"];

/**
 * A real navigation to the bare URL, which is what clicking a wordmark is expected to do.
 * Unlike an in-app reset it leaves a history entry, so Back recovers the case — and unlike
 * next/link it does not client-side navigate to the same route, which would preserve the
 * very state the click is meant to discard. Plain <a href> is not basePath-rewritten by
 * Next, so the prefix is applied by hand (same as lib/engine.ts).
 */
const HOME_HREF = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;

/** Seed case shown on a first visit — a worked example, not the user's data. */
const SEED_HEIRS: HeirsInput = { husband: true, sons: 2, daughters: 1 };

/** Below this width the form stacks above the result, so the action bar detaches. */
const STACKED_BREAKPOINT = 940;

/** Live recalculation delay. Long enough to coalesce stepper taps, short enough to feel live. */
const RECALC_DEBOUNCE_MS = 250;

function cleanEstate(e: EstateInput): EstateInput | undefined {
  const entries = Object.entries(e).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export default function Home() {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<Mode>("personal");
  const [ruleset, setRuleset] = useState<Ruleset>("khi");
  const [heirs, setHeirs] = useState<HeirsInput>(SEED_HEIRS);
  const [estate, setEstate] = useState<EstateInput>({});
  const [hartaBersama, setHartaBersama] = useState(false);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonEntry[] | null>(null);
  const [calculatedHeirs, setCalculatedHeirs] = useState<HeirsInput | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [error, setError] = useState<CalculationError | string | null>(null);
  // "initial" shows the skeleton; "live" dims the existing result instead of replacing it.
  const [busy, setBusy] = useState<"idle" | "initial" | "live">("idle");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [pendingCalc, setPendingCalc] = useState(false);
  const [view, setView] = useState<"table" | "diagram">("table");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  const resultRef = useRef<HTMLElement | null>(null);
  const hasResult = !!result || !!comparison;

  const shareState: ShareableState = { heirs, estate, ruleset, mode, hartaBersama, compareMode };

  const buildRequest = useCallback((): CalculationRequest => ({
    heirs,
    ruleset,
    apply_harta_bersama: ruleset === "khi" && hartaBersama,
    estate: cleanEstate(estate),
  }), [heirs, ruleset, hartaBersama, estate]);

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
      setError(err instanceof CalculationError ? err : t("preparing"));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(currentShareUrl(shareState));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard denied — the URL is already in the address bar, so nothing is lost. */
    }
  }

  // Rapid edits can resolve out of order; only the newest request may write state.
  const seqRef = useRef(0);

  const runCalc = useCallback(async (kind: "initial" | "live") => {
    const seq = ++seqRef.current;
    setBusy(kind);
    setError(null);
    const req = buildRequest();
    const snapshot = heirs;
    try {
      if (compareMode) {
        const data = await compare(req, ["khi", "syafii"], mode, lang);
        if (seq !== seqRef.current) return;
        setComparison(data);
        setResult(null);
      } else {
        const data = await calculate(req, mode, lang);
        if (seq !== seqRef.current) return;
        setResult(data);
        setComparison(null);
      }
      setCalculatedHeirs(snapshot);
      writeStateToUrl({ heirs: snapshot, estate, ruleset, mode, hartaBersama, compareMode });
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof CalculationError ? err : t("server_error"));
      setResult(null);
      setComparison(null);
    } finally {
      if (seq === seqRef.current) setBusy("idle");
    }
    // `t` is stable per language and `lang` is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildRequest, compareMode, mode, lang, heirs, estate, ruleset, hartaBersama]);

  /**
   * Clear the case: heirs, estate, result and the URL. Madhab, mode, language and theme
   * survive — those are preferences, not case data, and silently dropping a professional
   * back to Personal/KHI mid-session would be its own bug.
   *
   * The disclaimer stays accepted: it has been read, and re-gating it would punish the
   * user for starting a second case.
   */
  function resetCase() {
    // Invalidate any in-flight calculation so a late response cannot repopulate the pane
    // we are in the middle of emptying.
    seqRef.current += 1;
    setHeirs({});
    setEstate({});
    setHartaBersama(false);
    setResult(null);
    setComparison(null);
    setCalculatedHeirs(null);
    setError(null);
    setBusy("idle");
    clearStateFromUrl();
  }

  function onSubmit() {
    if (!disclaimerAccepted) {
      setPendingCalc(true); // gate first calculation behind the disclaimer (PRD §7)
      return;
    }
    void runCalc("initial");
    scrollToResult();
  }

  function scrollToResult() {
    if (typeof window === "undefined" || window.innerWidth > STACKED_BREAKPOINT) return;
    // Stacked layout: the result sits below the whole form, so bring it into view.
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // Start downloading the WebAssembly engine immediately. Entering heirs takes far
  // longer than the download, so by the time Calculate is pressed it is usually ready.
  useEffect(() => {
    void preloadEngine().catch(() => {
      /* surfaced by <EngineStatus />; a failure here must not break the form */
    });
  }, []);

  // Restore a shared link. Read after mount, not during render: the page is statically
  // prerendered, so touching window during render would be a hydration mismatch. Inputs are
  // restored but NOT auto-calculated — the disclaimer gate still applies to the first run.
  useEffect(() => {
    const restored = decodeState(window.location.search);
    if (!restored) return;
    setRuleset(restored.ruleset);
    setMode(restored.mode);
    setHeirs(restored.heirs);
    setEstate(restored.estate);
    setHartaBersama(restored.hartaBersama);
    setCompareMode(restored.compareMode);
  }, []);

  // Live recalculation. The engine is local WASM, so re-running on every edit costs a few
  // milliseconds and removes the scroll-down-to-press-Calculate loop entirely. Only after a
  // first accepted calculation, so the disclaimer is never bypassed.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (!disclaimerAccepted || !hasResult) return;
    const timer = setTimeout(() => void runCalc("live"), RECALC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // hasResult is deliberately excluded: it flips true on the first result and would
    // otherwise queue an immediate redundant recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heirs, estate, ruleset, hartaBersama, mode, compareMode, lang, disclaimerAccepted]);

  // Only offer to clear when there is something to clear, so the control never reads as a
  // live destructive action on an already-empty form.
  const isDirty =
    totalHeirs(heirs) > 0 || Object.values(estate).some(Boolean) || hasResult || !!error;

  /**
   * An empty heir set comes back from the engine as `unsupported` ("No heirs provided"),
   * which would render the "this fiqh configuration isn't supported yet — consult an
   * ustadz" panel at someone who has simply not filled the form in. Block the calculation
   * instead of explaining it away afterwards.
   */
  const canCalculate = totalHeirs(heirs) > 0;

  const isUnsupported = error instanceof CalculationError && !error.supported;
  const errorMessage = error instanceof CalculationError ? error.message : error;

  const actionButton = (
    <button
      className="btn btn-lg"
      onClick={onSubmit}
      disabled={busy !== "idle" || !canCalculate}
      title={!canCalculate ? t("need_heirs") : undefined}
    >
      {busy !== "idle" ? (
        busy === "live" ? t("updating") : t("calculating")
      ) : (
        <><Icon name="scale" size={17} /> {compareMode ? t("calc_compare") : hasResult ? t("recalculate") : t("calc")}</>
      )}
    </button>
  );

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <a className="brand" href={HOME_HREF} title={t("go_home")} aria-label={t("go_home")}>
            <div className="brand-mark"><Icon name="scale" size={22} /></div>
            <div>
              <div className="brand-name">Faraid<b>Visualizer</b></div>
              <div className="brand-tag">{t("app_tagline")}</div>
            </div>
          </a>
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
          <div className="card form-card">
            <div className="form-scroll">
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

              <div className="divider" />

              <HeirForm
                heirs={heirs} setHeirs={setHeirs} estate={estate} setEstate={setEstate}
                ruleset={ruleset} hartaBersama={hartaBersama} setHartaBersama={setHartaBersama}
              />
            </div>

            <div className="form-actions">
              <EngineStatus />
              {actionButton}
              <label className="check-line" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
                {t("compare_toggle")}
              </label>
              {!canCalculate ? (
                <div className="live-hint">{t("need_heirs")}</div>
              ) : hasResult && disclaimerAccepted ? (
                <div className="live-hint">
                  <Icon name="sparkles" size={13} /> {t("live_hint")}
                </div>
              ) : null}
              {isDirty && (
                <div className="reset-row">
                  <button className="btn-reset" type="button" onClick={resetCase} title={t("new_case_hint")}>
                    <Icon name="refresh" size={14} /> {t("new_case")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ---- Result pane ---- */}
        <section className="pane-result" ref={resultRef}>
          {error ? (
            <div className="card card-pad">
              {isUnsupported ? (
                <div className="unsupported-box">
                  <span className="c-ico"><Icon name="info" size={18} /></span>
                  <div>
                    <strong>{t("unsupported_title")}</strong>
                    <div className="small" style={{ marginTop: 6 }}>{t("unsupported_body")}</div>
                    {errorMessage && <div className="u-detail">{errorMessage}</div>}
                  </div>
                </div>
              ) : (
                <div className="error-box">
                  <Icon name="alert" size={18} />
                  <div>
                    <strong>{t("cannot_calc")}</strong>
                    <div className="small" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{errorMessage}</div>
                  </div>
                </div>
              )}
            </div>
          ) : busy === "initial" ? (
            <div className="card card-pad">
              <div className="skeleton" style={{ height: 22, width: "40%", marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 34, width: "100%", marginBottom: 20 }} />
              {[...Array(4)].map((_, i) => (
                <div className="skeleton" key={i} style={{ height: 58, width: "100%", marginBottom: 8 }} />
              ))}
            </div>
          ) : comparison ? (
            <div className={`card card-pad ${busy === "live" ? "pane-updating" : ""}`}>
              <div className="card-title" style={{ marginBottom: 16 }}><Icon name="book" size={18} /> {t("comparison_title")}</div>
              {calculatedHeirs && <div style={{ marginBottom: 16 }}><InputSummary heirs={calculatedHeirs} /></div>}
              <ComparisonView entries={comparison} />
            </div>
          ) : result ? (
            <div className={`card ${busy === "live" ? "pane-updating" : ""}`}>
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
                  <button className="btn btn-secondary" onClick={handleCopyLink} title={t("copy_link_hint")}>
                    <Icon name={copied ? "info" : "branch"} size={16} /> {copied ? t("copied") : t("copy_link")}
                  </button>
                  {result.mode === "professional" && (
                    <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
                      <Icon name="download" size={16} /> {exportingPdf ? t("pdf_preparing") : t("export_pdf")}
                    </button>
                  )}
                </div>
              </div>
              <div className="card-pad">
                {calculatedHeirs && (
                  <div style={{ marginBottom: 18 }}><InputSummary heirs={calculatedHeirs} /></div>
                )}
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

      {/* Stacked layout only — the desktop action bar lives inside the form card. */}
      <div className="mobile-actions">
        {actionButton}
        {hasResult && (
          <button className="btn btn-secondary" onClick={scrollToResult}>
            <Icon name="arrow" size={16} /> {t("view_result")}
          </button>
        )}
      </div>

      {pendingCalc && (
        <DisclaimerModal
          onAccept={() => {
            setDisclaimerAccepted(true);
            setPendingCalc(false);
            void runCalc("initial");
            scrollToResult();
          }}
        />
      )}
    </>
  );
}
