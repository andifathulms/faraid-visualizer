// Typed client for the Faraid Visualizer DRF backend.
// Mirrors api/services.py:serialize_result — keep in sync with that shape.

export type Ruleset = "khi" | "syafii" | "hanafi" | "maliki" | "hanbali";
export type Mode = "personal" | "professional";

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
  count: number;
  share: FractionValue;
  per_head: FractionValue;
  category: "furud" | "asabah" | "radd" | "dzawil_arham" | "harta_bersama";
  asabah_type: string | null;
  rule_applied: string;
  reason: string;
  source_id: string;
  amount: string | null;
}

export interface Blocked {
  relation: string;
  label_id: string;
  count: number;
  blocked_by: string;
  blocked_by_label: string;
  reason: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export class CalculationError extends Error {
  supported: boolean;
  constructor(message: string, supported = false) {
    super(message);
    this.name = "CalculationError";
    this.supported = supported;
  }
}

export async function calculate(
  req: CalculationRequest,
  mode: Mode
): Promise<CalculationResult> {
  const res = await fetch(`${API_BASE}/api/calculate/${mode}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (res.status === 422) {
    const err = (await res.json()) as ApiError;
    throw new CalculationError(err.detail, false);
  }
  if (res.status === 400) {
    const err = await res.json();
    throw new CalculationError(
      typeof err === "object" ? JSON.stringify(err) : String(err),
      true
    );
  }
  if (!res.ok) {
    throw new CalculationError(`Server error (${res.status})`, true);
  }
  return (await res.json()) as CalculationResult;
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
  mode: Mode
): Promise<ComparisonEntry[]> {
  const res = await fetch(`${API_BASE}/api/compare/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, rulesets, mode }),
  });
  if (res.status === 400) {
    const err = await res.json();
    throw new CalculationError(JSON.stringify(err), true);
  }
  if (!res.ok) throw new CalculationError(`Server error (${res.status})`, true);
  return ((await res.json()).comparison as ComparisonEntry[]) ?? [];
}

// Professional-mode PDF export (PRD §7). Returns the PDF as a Blob for download.
export async function fetchPdf(req: CalculationRequest): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/calculate/professional/pdf/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (res.status === 422) {
    const err = (await res.json()) as ApiError;
    throw new CalculationError(err.detail, false);
  }
  if (!res.ok) {
    throw new CalculationError(`Gagal membuat PDF (${res.status})`, true);
  }
  return await res.blob();
}
