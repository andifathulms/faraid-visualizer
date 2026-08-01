// Typed client for the Faraid rule engine.
//
// The static build has no server: these calls run the real Python engine in the browser
// via lib/engine.ts (Pyodide). The payload and response shapes are unchanged from the
// DRF API — faraid_web produces the same wire format in both deployments — so these
// types describe the hosted API and the static build equally.
//
// Mirrors backend/faraid_web/serialize.py:serialize_result — keep in sync with that shape.

import { callEngine, ensurePdfSupport, type Envelope } from "@/lib/engine";

export type Ruleset = "khi" | "syafii" | "hanafi" | "maliki" | "hanbali";
export type Mode = "personal" | "professional";
type Lang = "id" | "en"; // structurally identical to lib/i18n's Lang

export interface Representative {
  replacing: "son" | "daughter";
  sons: number;
  daughters: number;
}

export interface HeirsInput {
  husband?: boolean;
  wives?: number;
  sons?: number;
  daughters?: number;
  father?: boolean;
  mother?: boolean;
  paternal_grandfather?: boolean;
  paternal_grandmother?: boolean;
  maternal_grandmother?: boolean;
  grandsons_via_son?: number;
  granddaughters_via_son?: number;
  full_brothers?: number;
  full_sisters?: number;
  paternal_brothers?: number;
  paternal_sisters?: number;
  maternal_siblings?: number;
  representatives?: Representative[];
}

export interface EstateInput {
  gross_value?: string;
  funeral_costs?: string;
  debts?: string;
  wasiyya?: string;
  joint_assets?: string;
}

export interface CalculationRequest {
  heirs: HeirsInput;
  ruleset: Ruleset;
  estate?: EstateInput;
  apply_harta_bersama?: boolean;
}

export interface FractionValue {
  numerator: number;
  denominator: number;
  text: string;
  float: number;
}

export interface Share {
  relation: string;
  label_id: string;
  label: string; // localized display name (server-rendered per lang)
  count: number;
  share: FractionValue;
  per_head: FractionValue;
  category: "furud" | "asabah" | "radd" | "dzawil_arham" | "harta_bersama";
  category_label: string; // localized
  asabah_type: string | null;
  rule_applied: string;
  reason: string; // localized derivation prose (server single source of truth)
  source_id: string;
  amount: string | null;
}

export interface Blocked {
  relation: string;
  label_id: string;
  label: string; // localized
  count: number;
  blocked_by: string;
  blocked_by_label: string;
  reason: string; // localized
  source_id: string;
  full: boolean;
}

export interface Step {
  step: string;
  title: string;
  detail: string;
  source_id: string | null;
  data: Record<string, unknown>;
}

export interface SourceCitation {
  id: string;
  type: string;
  reference: string;
  pointer: string;
  note: string;
}

export interface EstateBreakdown {
  gross_value: string;
  funeral_costs: string;
  debts: string;
  wasiyya: string;
  harta_bersama_deducted: string;
  net_divisible: string;
}

export interface CalculationResult {
  ruleset: Ruleset;
  mode: Mode;
  beta: boolean;
  pokok_masalah: number;
  aul_applied: boolean;
  aul_base: number | null;
  radd_applied: boolean;
  estate: EstateBreakdown | null;
  shares: Share[];
  blocked: Blocked[];
  steps: Step[];
  notes: string[];
  disclaimer: string;
  sources: Record<string, SourceCitation>;
}

export interface ApiError {
  error: string;
  detail: string;
  supported?: boolean;
}

export class CalculationError extends Error {
  /**
   * False when the engine refused a configuration it does not handle — the user should
   * be told the case is unsupported, never shown a guessed number. True for input the
   * form should not have allowed through, which is a bug on our side.
   */
  supported: boolean;
  constructor(message: string, supported = false) {
    super(message);
    this.name = "CalculationError";
    this.supported = supported;
  }
}

/** Turn a bridge error envelope into the error the UI already knows how to render. */
function toError(env: Extract<Envelope<unknown>, { ok: false }>): CalculationError {
  if (env.kind === "unsupported") {
    return new CalculationError(String(env.detail), false);
  }
  const detail =
    typeof env.detail === "string" ? env.detail : JSON.stringify(env.detail);
  return new CalculationError(detail, true);
}

async function run<T>(
  action: "calculate" | "compare" | "pdf",
  request: Record<string, unknown>
): Promise<T> {
  const env = await callEngine<T>(action, request);
  if (!env.ok) throw toError(env);
  return env.data;
}

export async function calculate(
  req: CalculationRequest,
  mode: Mode,
  lang: Lang = "id"
): Promise<CalculationResult> {
  return run<CalculationResult>("calculate", {
    payload: { ...req, lang },
    mode_override: mode,
  });
}

export interface ComparisonEntry {
  ruleset: Ruleset;
  ok: boolean;
  result?: CalculationResult;
  error?: string;
  detail?: string;
}

// Compare the same heirs across rule sets (KHI vs Syafi'i by default).
export async function compare(
  req: CalculationRequest,
  rulesets: Ruleset[],
  mode: Mode,
  lang: Lang = "id"
): Promise<ComparisonEntry[]> {
  const data = await run<{ comparison: ComparisonEntry[] }>("compare", {
    payload: { ...req, lang },
    rulesets,
    mode_override: mode,
  });
  return data.comparison ?? [];
}

// Professional-mode PDF export (PRD §7). Returns the PDF as a Blob for download.
// Pulls in the PDF renderer on first use — it is not part of the engine boot.
export async function fetchPdf(req: CalculationRequest, lang: Lang = "id"): Promise<Blob> {
  await ensurePdfSupport();
  const { pdf_base64 } = await run<{ pdf_base64: string }>("pdf", {
    payload: { ...req, lang },
  });

  const binary = atob(pdf_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}
