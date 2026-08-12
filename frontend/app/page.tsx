"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
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
import DivergenceNotice from "@/components/DivergenceNotice";
import EngineStatus from "@/components/EngineStatus";
import ResultAnnouncer from "@/components/ResultAnnouncer";
import SensitivityPanel from "@/components/SensitivityPanel";
import WorkedExample, { EXAMPLE_CASE } from "@/components/WorkedExample";
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

/** Brand mark. Plain <img>, so the basePath is applied by hand as above. */
const BRAND_ICON = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/faraidvisualizer-icon.svg`;

/**
 * Seed case shown on a first visit — a worked example, not the user's data.
 *
 * The estate is seeded too, and deliberately matches components/WorkedExample: reading
 * the example and pressing Calculate must produce the same figures, or the example is
 * teaching something the app does not do.
 */
const SEED_HEIRS: HeirsInput = EXAMPLE_CASE.heirs;
const SEED_ESTATE: EstateInput = EXAMPLE_CASE.estate ?? {};

/**
 * Whether the form still holds the untouched seed case, so it can be labelled as the
 * example it is. Purely a labelling question — nothing about the calculation branches on
 * this. Absent, false, 0 and [] are all treated as "not entered", which is how the rest of
 * the form already reads them, so a heir toggled on and back off does not count as an edit.
 */
function isSeedCase(heirs: HeirsInput): boolean {
  const empty = (v: unknown) => v === undefined || v === false || v === 0 || (Array.isArray(v) && v.length === 0);
  const keys = new Set([...Object.keys(heirs), ...Object.keys(SEED_HEIRS)]);
  for (const key of keys) {
    const a = (heirs as Record<string, unknown>)[key];
    const b = (SEED_HEIRS as Record<string, unknown>)[key];
    if (empty(a) && empty(b)) continue;
    if (a !== b) return false;
  }
  return true;
}

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
  const [estate, setEstate] = useState<EstateInput>(SEED_ESTATE);
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

  const rulesetId = useId();
  const resultRef = useRef<HTMLElement | null>(null);
  const hasResult = !!result || !!comparison;

  // A shared link can restore heirs that happen to equal the seed. Those are the sender's
  // real case, not our example, so the label must not claim otherwise.
  const restoredFromUrl = useRef(false);

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
    // Smooth scrolling is a common vestibular trigger, and this one was unconditional.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    );
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
    restoredFromUrl.current = true;
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
            {/* Plain <img>: Next only rewrites basePath for next/image, and images are
                unoptimized in a static export anyway. The mark carries its own rounded
                dark plate, so it needs no tile behind it. */}
            <img className="brand-mark" src={BRAND_ICON} width={40} height={40} alt="" />

            <div>
              <div className="brand-name">Faraid<b>Visualizer</b></div>
              <div className="brand-tag">{t("app_tagline")}</div>
            </div>
          </a>
          <div className="row gap-10">
            {/* The citation registry is the substrate the results stand on, so it gets a
                permanent way in — not only a hover on a chip inside a result. */}
            <Link className="bar-link" href="/references">
              <Icon name="book" size={15} /> <span className="bar-link-label">{t("ref_title")}</span>
            </Link>
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

      {/* The proposition, stated once, above the fold. Before this existed the only
          explanation of the product was the 12px tagline under the wordmark — sized, in
          this design system, for de-emphasised metadata. A stranger read the page as a
          data-entry form and never learned that the derivation is the point. */}
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">{t("hero_title")}</h1>
          <p className="hero-lede">{t("hero_lede")}</p>
          <ul className="hero-points">
            <li><Icon name="sitemap" size={15} /> {t("hero_pt_reasoning")}</li>
            <li><Icon name="book" size={15} /> {t("hero_pt_cited")}</li>
            <li><Icon name="shield" size={15} /> {t("hero_pt_private")}</li>
          </ul>
        </div>
      </section>

      <main className="layout">
        {/* ---- Input pane ---- */}
        <aside className="pane-form">
          <div className="card form-card">
            <div className="form-scroll">
              <div className="card-title" style={{ marginBottom: "var(--sp-3)" }}>
                <Icon name="users" size={18} /> {t("form_title")}
              </div>

              {/* Says out loud what the pre-filled values are. Disappears the moment the
                  heirs differ from the seed, so it never lingers over the user's own data. */}
              {!restoredFromUrl.current && isSeedCase(heirs) && (
                <div className="seed-note">
                  <Icon name="info" size={15} />
                  <span>
                    <b>{t("seed_badge")}</b> — {t("seed_badge_hint")}
                  </span>
                </div>
              )}

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
              <p className="small muted" style={{ marginTop: "var(--sp-2)" }}>
                {mode === "professional" ? t("mode_hint_professional") : t("mode_hint_personal")}
              </p>

              <div className="divider" />

              <div className="field">
                {/* A real <label>, not a styled span: the AX tree reported this — the most
                    consequential control in the app — as an UNNAMED combobox. */}
                <label className="field-label" htmlFor={rulesetId}>{t("legal_basis")}</label>
                <select
                  id={rulesetId}
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
              <label className="check-line" style={{ marginTop: "var(--sp-3)" }}>
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
          {/* Visually hidden; the only thing that tells a non-sighted user the live
              recalculation produced a new answer. */}
          <ResultAnnouncer result={result} comparison={comparison} error={error} busy={busy} />
          {error ? (
            <div className="card card-pad">
              {isUnsupported ? (
                <div className="unsupported-box">
                  <span className="c-ico"><Icon name="info" size={18} /></span>
                  <div>
                    <strong>{t("unsupported_title")}</strong>
                    <div className="small" style={{ marginTop: "var(--sp-15)" }}>{t("unsupported_body")}</div>
                    {errorMessage && <div className="u-detail">{errorMessage}</div>}
                  </div>
                </div>
              ) : (
                <div className="error-box">
                  <Icon name="alert" size={18} />
                  <div>
                    <strong>{t("cannot_calc")}</strong>
                    <div className="small" style={{ marginTop: "var(--sp-1)", whiteSpace: "pre-wrap" }}>{errorMessage}</div>
                  </div>
                </div>
              )}
            </div>
          ) : busy === "initial" ? (
            <div className="card card-pad">
              <div className="skeleton" style={{ height: 22, width: "40%", marginBottom: "var(--sp-4)" }} />
              <div className="skeleton" style={{ height: 34, width: "100%", marginBottom: "var(--sp-5)" }} />
              {[...Array(4)].map((_, i) => (
                <div className="skeleton" key={i} style={{ height: 58, width: "100%", marginBottom: "var(--sp-2)" }} />
              ))}
            </div>
          ) : comparison ? (
            <div className={`card card-pad ${busy === "live" ? "pane-updating" : ""}`}>
              <div className="card-title" style={{ marginBottom: "var(--sp-4)" }}><Icon name="book" size={18} /> {t("comparison_title")}</div>
              {calculatedHeirs && <div style={{ marginBottom: "var(--sp-4)" }}><InputSummary heirs={calculatedHeirs} /></div>}
              <ComparisonView entries={comparison} />
            </div>
          ) : result ? (
            <div className={`card ${busy === "live" ? "pane-updating" : ""}`}>
              <div className="card-head">
                <div className="card-title">
                  <Icon name="scale" size={18} /> {t("result")}
                  <span className="badge badge-primary" style={{ marginLeft: "var(--sp-05)" }}>{rulesetLabel(result.ruleset, lang)}</span>
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
                  <div style={{ marginBottom: "var(--sp-4)" }}><InputSummary heirs={calculatedHeirs} /></div>
                )}
                {/* Sits above the shares, not below them: a user who learns only after
                    reading the answer that another school divides differently has already
                    formed the view the notice exists to qualify. */}
                {result.divergence && (
                  <div style={{ marginBottom: "var(--sp-4)" }}>
                    <DivergenceNotice
                      divergence={result.divergence}
                      onCompare={() => setCompareMode(true)}
                    />
                  </div>
                )}
                {view === "table" ? (
                  <>
                    <ResultView result={result} />
                    {/* Below the result and its disclaimer: it answers a question that
                        only arises once the answer has been read. */}
                    <div style={{ marginTop: "var(--sp-5)" }}>
                      <SensitivityPanel request={buildRequest()} mode={mode} />
                    </div>
                  </>
                ) : (
                  <>
                    <DerivationFlow result={result} />
                    <div className="callout callout-warn" style={{ marginTop: "var(--sp-4)" }}>
                      <span className="c-ico"><Icon name="alert" size={17} /></span>
                      <span>{result.disclaimer}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              {/* A newcomer's only route to understanding used to be: fill in a form about
                  a dead relative, accept a disclaimer, read a result. This is a complete
                  case they can follow first, with the form already holding it. */}
              <WorkedExample />
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
