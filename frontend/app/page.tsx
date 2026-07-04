"use client";

import { useState } from "react";
import {
  calculate,
  CalculationError,
  CalculationRequest,
  CalculationResult,
  EstateInput,
  fetchPdf,
  HeirsInput,
  Mode,
  Ruleset,
} from "@/lib/api";
import { RULESET_LABELS } from "@/lib/labels";
import HeirForm from "@/components/HeirForm";
import ResultView from "@/components/ResultView";
import DerivationFlow from "@/components/DerivationFlow";
import DisclaimerModal from "@/components/DisclaimerModal";

const RULESETS: Ruleset[] = ["khi", "syafii", "hanafi", "maliki", "hanbali"];

function cleanEstate(e: EstateInput): EstateInput | undefined {
  const entries = Object.entries(e).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("personal");
  const [ruleset, setRuleset] = useState<Ruleset>("khi");
  const [heirs, setHeirs] = useState<HeirsInput>({ husband: true, sons: 2, daughters: 1 });
  const [estate, setEstate] = useState<EstateInput>({});
  const [hartaBersama, setHartaBersama] = useState(false);

  const [result, setResult] = useState<CalculationResult | null>(null);
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
      const blob = await fetchPdf(buildRequest());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "perhitungan-faraid.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof CalculationError ? err.message : "Gagal membuat PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function runCalc() {
    setLoading(true);
    setError(null);
    const req: CalculationRequest = buildRequest();
    try {
      const res = await calculate(req, mode);
      setResult(res);
    } catch (err) {
      const message =
        err instanceof CalculationError
          ? err.message
          : "Tidak dapat menghubungi server. Pastikan backend berjalan di :8000.";
      setError(message);
      setResult(null);
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

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Faraid Visualizer</h1>
          <div className="subtitle">
            Kalkulator waris Islam yang menunjukkan <em>alasan</em> setiap bagian, dengan rujukan.
          </div>
        </div>
        <div className="toggle-group" role="tablist" aria-label="Mode">
          <button className={mode === "personal" ? "active" : ""} onClick={() => setMode("personal")}>
            Personal
          </button>
          <button className={mode === "professional" ? "active" : ""} onClick={() => setMode("professional")}>
            Profesional
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Dasar hukum & ahli waris</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Dasar hukum (madhab)</label>
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
                {RULESET_LABELS[r]}
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

        <div style={{ marginTop: 20 }}>
          <button className="btn" onClick={onSubmit} disabled={loading}>
            {loading ? "Menghitung…" : "Hitung pembagian"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="error-box">
            <strong>Tidak dapat dihitung.</strong> {error}
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="header" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Hasil — {RULESET_LABELS[result.ruleset]}</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="toggle-group" role="tablist" aria-label="Tampilan">
                <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
                  Tabel
                </button>
                <button className={view === "diagram" ? "active" : ""} onClick={() => setView("diagram")}>
                  Diagram
                </button>
              </div>
              {result.mode === "professional" && (
                <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
                  {exportingPdf ? "Menyiapkan…" : "Ekspor PDF"}
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
