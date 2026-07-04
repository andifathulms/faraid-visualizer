// Bahasa Indonesia display labels (PRD §7: BI primary). Keyed by the engine's label_id.

export const RELATION_LABELS: Record<string, string> = {
  suami: "Suami",
  istri: "Istri",
  anak_laki: "Anak laki-laki",
  anak_perempuan: "Anak perempuan",
  ayah: "Ayah",
  ibu: "Ibu",
  kakek: "Kakek (dari ayah)",
  nenek_ayah: "Nenek (dari ayah)",
  nenek_ibu: "Nenek (dari ibu)",
  cucu_laki: "Cucu laki-laki (dari anak laki)",
  cucu_perempuan: "Cucu perempuan (dari anak laki)",
  saudara_laki_kandung: "Saudara laki-laki kandung",
  saudari_kandung: "Saudari kandung",
  saudara_laki_seayah: "Saudara laki-laki seayah",
  saudari_seayah: "Saudari seayah",
  saudara_seibu: "Saudara/i seibu",
};

export function relationLabel(labelId: string): string {
  return RELATION_LABELS[labelId] ?? labelId;
}

export const RULESET_LABELS: Record<string, string> = {
  khi: "KHI (Kompilasi Hukum Islam)",
  syafii: "Syafi'i (klasik)",
  hanafi: "Hanafi (Beta)",
  maliki: "Maliki (Beta)",
  hanbali: "Hanbali (Beta)",
};

export const CATEGORY_LABELS: Record<string, string> = {
  furud: "Bagian tetap (furud)",
  asabah: "Sisa (asabah)",
  radd: "Radd",
  dzawil_arham: "Dzawil arham",
  harta_bersama: "Harta bersama",
};
