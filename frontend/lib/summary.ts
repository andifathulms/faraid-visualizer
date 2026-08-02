// Human-readable summaries of the heir input.
//
// One derivation shared by two consumers: the collapsed form-section headers (so you can
// see what a closed section holds) and the result-pane chips (so you can see what produced
// the numbers without scrolling back to the form). Uses the same relation labels as the
// rest of the UI, so a heir is named identically everywhere.

import type { HeirsInput } from "@/lib/api";
import { relationLabel, type Lang } from "@/lib/i18n";

export interface HeirChip {
  /** Relation label id, e.g. "anak_laki" — also the React key. */
  id: string;
  label: string;
  count: number;
}

/** Which heir fields belong to which form section, in display order. */
export const SECTION_FIELDS = {
  spouse: ["husband", "wives"],
  children: ["sons", "daughters"],
  parents: ["father", "mother"],
  grandparents: ["paternal_grandfather", "paternal_grandmother", "maternal_grandmother"],
  grandchildren: ["grandsons_via_son", "granddaughters_via_son"],
  siblings: [
    "full_brothers",
    "full_sisters",
    "paternal_brothers",
    "paternal_sisters",
    "maternal_siblings",
  ],
} as const;

export type SectionKey = keyof typeof SECTION_FIELDS;

/** Heir field → relation label id used by RELATION_LABELS_I18N. */
const FIELD_LABELS: Record<string, string> = {
  husband: "suami",
  wives: "istri",
  sons: "anak_laki",
  daughters: "anak_perempuan",
  father: "ayah",
  mother: "ibu",
  paternal_grandfather: "kakek",
  paternal_grandmother: "nenek_ayah",
  maternal_grandmother: "nenek_ibu",
  grandsons_via_son: "cucu_laki",
  granddaughters_via_son: "cucu_perempuan",
  full_brothers: "saudara_laki_kandung",
  full_sisters: "saudari_kandung",
  paternal_brothers: "saudara_laki_seayah",
  paternal_sisters: "saudari_seayah",
  maternal_siblings: "saudara_seibu",
};

function countOf(heirs: HeirsInput, field: string): number {
  const v = (heirs as Record<string, unknown>)[field];
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v > 0 ? v : 0;
  return 0;
}

/** Every heir present in `fields`, as chips. Empty array when the section is untouched. */
export function chipsForFields(
  heirs: HeirsInput,
  fields: readonly string[],
  lang: Lang
): HeirChip[] {
  const chips: HeirChip[] = [];
  for (const field of fields) {
    const count = countOf(heirs, field);
    if (count === 0) continue;
    const id = FIELD_LABELS[field] ?? field;
    chips.push({ id, label: relationLabel(id, lang), count });
  }
  return chips;
}

/** Chips for one form section. */
export function chipsForSection(heirs: HeirsInput, section: SectionKey, lang: Lang): HeirChip[] {
  return chipsForFields(heirs, SECTION_FIELDS[section], lang);
}

/** Every heir entered, across all sections, plus substitute heirs. */
export function describeHeirs(heirs: HeirsInput, lang: Lang): HeirChip[] {
  const chips = (Object.keys(SECTION_FIELDS) as SectionKey[]).flatMap((s) =>
    chipsForSection(heirs, s, lang)
  );

  // Substitute heirs (KHI Art. 185) are grouped rather than listed one card at a time —
  // a chip row is a glance, not a derivation.
  const reps = heirs.representatives ?? [];
  const repHeads = reps.reduce((n, r) => n + (r.sons || 0) + (r.daughters || 0), 0);
  if (repHeads > 0) {
    chips.push({
      id: "pengganti",
      label: lang === "id" ? "Ahli waris pengganti" : "Substitute heirs",
      count: repHeads,
    });
  }
  return chips;
}

/** Compact one-line form for a collapsed section header: "Ayah · Ibu", "Anak laki-laki ×2". */
export function summarizeChips(chips: HeirChip[]): string {
  return chips.map((c) => (c.count > 1 ? `${c.label} ×${c.count}` : c.label)).join(" · ");
}

/** Total number of individual heirs entered — drives the "no heirs yet" state. */
export function totalHeirs(heirs: HeirsInput, lang: Lang = "id"): number {
  return describeHeirs(heirs, lang).reduce((n, c) => n + c.count, 0);
}
