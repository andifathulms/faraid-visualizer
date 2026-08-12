// Typed client for the Faraid rule engine.
//
// The static build has no server: these calls run the real Python engine in the browser
// via lib/engine.ts (Pyodide). The payload and response shapes are unchanged from the
// DRF API — faraid_web produces the same wire format in both deployments — so these
// types describe the hosted API and the static build equally.
//
// Mirrors backend/faraid_web/serialize.py:serialize_result — keep in sync with that shape.

import { callEngine, ensurePdfSupport, type EngineAction, type Envelope } from "@/lib/engine";

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
  /**
   * Group total against the net divisible estate. Note an omitted estate serializes as a
   * ZERO estate, not null, so this is "0.00" rather than null in that case — decide
   * whether money is meaningful from `estate.net_divisible`, not from this being set.
   */
  amount: string | null;
  /** Value of one member of the group. Derived server-side so the UI never divides money. */
  per_head_amount: string | null;
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

/**
 * One row of the siham working — an heir's share re-expressed as whole parts of the base.
 * Mirrors backend/faraid_web/working.py.
 */
export interface WorkingRow {
  label_id: string;
  label: string; // localized
  count: number;
  category: Share["category"];
  share: { numerator: number; denominator: number; text: string };
  siham: number;
  /** Exact per-individual parts. Non-integral is normal — that is what tashih resolves. */
  per_head_siham: { numerator: number; denominator: number; text: string };
}

export interface Working {
  /** The base the siham are expressed over: aul_base when 'aul fired, else pokok_masalah. */
  base: number;
  pokok_masalah: number;
  aul_base: number | null;
  aul_applied: boolean;
  radd_applied: boolean;
  rows: WorkingRow[];
  total_siham: number;
  /** False when a residue falls outside the heirs (baitul mal), recorded as a note. */
  balanced: boolean;
}

/**
 * Whether the counterpart Tier-1 rule set divides this case differently (PRD §4.1).
 * Mirrors backend/faraid_web/divergence.py. Null for Beta rule sets, which have no
 * designated counterpart.
 */
export interface Divergence {
  ruleset: Ruleset;
  ruleset_label: string;
  counterpart: Ruleset;
  counterpart_label: string;
  /** "unsupported" = the counterpart refuses the configuration, which is itself an answer. */
  status: "same" | "differs" | "unsupported";
  detail?: string;
  /** Fractions match, but KHI separates joint property first, so the amounts cannot. */
  harta_bersama_only?: boolean;
  rows: {
    relation: string;
    label_id: string;
    label: string;
    this: { numerator: number; denominator: number; text: string } | null;
    other: { numerator: number; denominator: number; text: string } | null;
  }[];
}

/**
 * A documented limit of the engine's coverage. Mirrors backend/faraid_engine/coverage.py.
 *
 * `kind` is the load-bearing field: "raises" and "uncapturable" announce themselves at
 * calculation time, while "silent" is a doctrine the engine omits from an answer that
 * otherwise looks complete — the only one the user cannot discover by using the app.
 */
export interface CoverageGap {
  key: string;
  kind: "raises" | "uncapturable" | "silent";
  kind_label: string;
  title: string;
  detail: string;
  source_id: string;
  source: SourceCitation;
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
  /**
   * The siham working, or null when it could not be derived exactly. Null means "render
   * no table" — never "render zeroes". See backend/faraid_web/working.py.
   */
  working: Working | null;
  /** What this rule set does not cover. Always present — see CoverageGap. */
  coverage_gaps: CoverageGap[];
  /** Present on a single calculation; absent inside a comparison entry, which IS one. */
  divergence?: Divergence | null;
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
  /** Raw bridge detail, kept for Professional mode / debugging. Never shown verbatim. */
  detail: unknown;
  constructor(message: string, supported = false, detail: unknown = null) {
    super(message);
    this.name = "CalculationError";
    this.supported = supported;
    this.detail = detail;
  }
}

/**
 * Render a validation detail as readable lines rather than dumping JSON at the user.
 * `invalid_input` details are a {field: [messages]} dict from validate.py.
 */
function describeInvalidInput(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!detail || typeof detail !== "object") return String(detail);

  const lines = Object.entries(detail as Record<string, unknown>).map(([field, msgs]) => {
    const text = Array.isArray(msgs) ? msgs.join("; ") : String(msgs);
    return field === "__all__" ? text : `${field}: ${text}`;
  });
  return lines.join("\n");
}

/** Turn a bridge error envelope into the error the UI already knows how to render. */
function toError(env: Extract<Envelope<unknown>, { ok: false }>): CalculationError {
  if (env.kind === "unsupported") {
    // The engine refused to guess. This is correct behaviour, not a failure.
    return new CalculationError(String(env.detail), false, env.detail);
  }
  return new CalculationError(describeInvalidInput(env.detail), true, env.detail);
}

async function run<T>(
  action: EngineAction,
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

/** One single-slot counterfactual. Mirrors backend/faraid_web/sensitivity.py. */
export interface SensitivityRow {
  slot: string;
  relation: string;
  label: string;
  direction: "add" | "remove";
  from: number | boolean;
  to: number | boolean;
  status: "changes" | "no_change" | "unsupported" | "engine_error";
  detail?: string;
  changed: {
    relation: string;
    label: string;
    from: { numerator: number; denominator: number; text: string } | null;
    to: { numerator: number; denominator: number; text: string } | null;
  }[];
  /** For an added heir who changes nothing, the heir who blocks them. */
  blocked_by?: string | null;
  blocked_reason_source?: string | null;
}

export interface Sensitivity {
  base_ruleset: Ruleset;
  changing: SensitivityRow[];
  inert: SensitivityRow[];
  refused: SensitivityRow[];
  counts: { changing: number; inert: number; refused: number };
}

/**
 * Which heirs are load-bearing for this case. Roughly thirty extra engine runs, so it is
 * a separate call made when the user asks for it rather than a field on every result.
 */
export async function sensitivity(
  req: CalculationRequest,
  mode: Mode,
  lang: Lang = "id"
): Promise<Sensitivity> {
  return run<Sensitivity>("sensitivity", {
    payload: { ...req, lang },
    mode_override: mode,
  });
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
