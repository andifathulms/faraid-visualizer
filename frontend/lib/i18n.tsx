"use client";

// Frontend i18n (PRD §7: Bahasa Indonesia primary, English secondary).
//
// Derivation TEXT (reasons, labels, categories, step titles, notes, disclaimer) is
// localized server-side and returned already-translated per the `lang` sent with each
// request (single source of truth in the API layer). This module only supplies the
// static UI chrome (headings, buttons, form labels) and the form-time relation/ruleset
// labels shown before a calculation exists.

import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "id" | "en";

type Dict = Record<string, { id: string; en: string }>;

export const STRINGS: Dict = {
  app_title: { id: "Faraid Visualizer", en: "Faraid Visualizer" },
  app_subtitle: {
    id: "Kalkulator waris Islam yang menunjukkan alasan setiap bagian, dengan rujukan.",
    en: "An Islamic inheritance calculator that shows the reason for every share, with sources.",
  },
  mode_personal: { id: "Personal", en: "Personal" },
  mode_professional: { id: "Profesional", en: "Professional" },
  app_tagline: { id: "Waris Islam, beserta alasannya", en: "Islamic inheritance, with the reasoning" },
  form_title: { id: "Ahli waris & harta", en: "Heirs & estate" },
  mode_hint_personal: { id: "Bahasa sederhana dengan penjelasan “kenapa”.", en: "Plain language with why-explanations." },
  mode_hint_professional: { id: "Derivasi lengkap, rujukan, ekspor PDF.", en: "Full derivation, citations, PDF export." },
  empty_title: { id: "Siap menghitung", en: "Ready to calculate" },
  empty_body: { id: "Isi ahli waris di sebelah kiri lalu tekan Hitung untuk melihat pembagian beserta alasan dan rujukannya.", en: "Fill in the heirs on the left, then press Calculate to see the shares with their reasoning and sources." },
  legal_basis: { id: "Dasar hukum (madhab)", en: "Legal basis (madhab)" },
  heirs_card_title: { id: "Dasar hukum & ahli waris", en: "Legal basis & heirs" },
  calc: { id: "Hitung pembagian", en: "Calculate shares" },
  calc_compare: { id: "Bandingkan pembagian", en: "Compare shares" },
  calculating: { id: "Menghitung…", en: "Calculating…" },
  compare_toggle: { id: "Bandingkan KHI vs Syafi'i berdampingan", en: "Compare KHI vs Syafi'i side by side" },
  result: { id: "Hasil", en: "Result" },
  comparison_title: { id: "Perbandingan madzhab", en: "Madhab comparison" },
  not_computable: { id: "Tidak dapat dihitung pada madzhab ini.", en: "Not computable under this school." },
  server_error: {
    id: "Tidak dapat menghubungi server. Pastikan backend berjalan di :8000.",
    en: "Could not reach the server. Make sure the backend is running on :8000.",
  },
  cannot_calc: { id: "Tidak dapat dihitung.", en: "Cannot be calculated." },
  export_pdf: { id: "Ekspor PDF", en: "Export PDF" },
  preparing: { id: "Menyiapkan…", en: "Preparing…" },
  view_table: { id: "Tabel", en: "Table" },
  view_diagram: { id: "Diagram", en: "Diagram" },

  // Form sections
  sec_spouse: { id: "Pasangan", en: "Spouse" },
  sec_children: { id: "Anak", en: "Children" },
  sec_parents: { id: "Orang tua", en: "Parents" },
  sec_grandparents: { id: "Kakek & Nenek", en: "Grandparents" },
  sec_grandchildren: { id: "Cucu (dari anak laki-laki)", en: "Grandchildren (through a son)" },
  sec_siblings: { id: "Saudara", en: "Siblings" },
  sec_pengganti: { id: "Ahli waris pengganti (KHI Pasal 185)", en: "Substitute heirs (KHI Art. 185)" },
  sec_estate: { id: "Harta peninggalan (opsional)", en: "Estate (optional)" },
  pengganti_hint: {
    id: "Untuk anak yang telah wafat lebih dulu; keturunannya menggantikan bagiannya. Konsep ini tidak ada dalam fiqh Syafi'i klasik.",
    en: "For a child who predeceased; their descendants take the child's place. This concept does not exist in classical Syafi'i fiqh.",
  },
  add_pengganti: { id: "+ Tambah ahli waris pengganti", en: "+ Add substitute heir" },
  remove: { id: "Hapus", en: "Remove" },
  replacing: { id: "Menggantikan", en: "Replacing" },
  predeceased_son: { id: "Anak laki-laki (wafat)", en: "Son (deceased)" },
  predeceased_daughter: { id: "Anak perempuan (wafat)", en: "Daughter (deceased)" },

  // Estate fields
  gross_value: { id: "Nilai kotor", en: "Gross value" },
  funeral_costs: { id: "Biaya pemakaman", en: "Funeral costs" },
  debts: { id: "Utang", en: "Debts" },
  wasiyya: { id: "Wasiat (maks 1/3)", en: "Bequest (max 1/3)" },
  joint_assets: { id: "Total harta bersama", en: "Total joint assets" },
  harta_bersama_toggle: {
    id: "Pisahkan harta bersama (1/2) sebelum faraid",
    en: "Separate joint property (1/2) before faraid",
  },

  // Result labels
  divisible_estate: { id: "Harta yang dibagi", en: "Divisible estate" },
  distribution: { id: "Pembagian", en: "Distribution" },
  pokok_masalah: { id: "pokok masalah", en: "base" },
  th_heir: { id: "Ahli waris", en: "Heir" },
  th_share: { id: "Bagian", en: "Share" },
  th_perhead: { id: "Per orang", en: "Per person" },
  th_basis: { id: "Dasar", en: "Basis" },
  th_amount: { id: "Jumlah", en: "Amount" },
  why: { id: "kenapa?", en: "why?" },
  hide: { id: "sembunyikan", en: "hide" },
  blocked_title: { id: "Terhalang (hajb)", en: "Blocked (hajb)" },
  blocked_by: { id: "Terhalang oleh", en: "Blocked by" },
  steps_title: { id: "Langkah penurunan", en: "Derivation steps" },
  notes_title: { id: "Catatan", en: "Notes" },
  beta_warn: {
    id: "Rule set ini masih dalam validasi ilmiah dan belum boleh dijadikan dasar pembagian final.",
    en: "This rule set is still under scholarly validation and must not be used as the basis for a final division.",
  },

  // Categories
  cat_furud: { id: "Bagian tetap (furud)", en: "Fixed share (furud)" },
  cat_asabah: { id: "Sisa (asabah)", en: "Residuary (asabah)" },
  cat_radd: { id: "Radd", en: "Radd (return)" },
  cat_dzawil_arham: { id: "Dzawil arham", en: "Distant kindred" },
  cat_harta_bersama: { id: "Harta bersama", en: "Joint property" },

  disclaimer_personal: {
    id: "Ini adalah alat bantu edukasi, BUKAN fatwa atau putusan hukum. Untuk pembagian waris yang sah, konsultasikan dengan ustadz, notaris, atau PPAIW / Pengadilan Agama.",
    en: "This is an educational tool, NOT a fatwa or legal ruling. For a valid estate division, consult an ustadz, notary, or PPAIW / Religious Court.",
  },
  disclaimer_professional: {
    id: "Hasil ini bersifat advisory dan tidak menggantikan penetapan resmi. Setiap kaidah disertai rujukan; verifikasi tetap tanggung jawab pengguna profesional. Bukan dokumen hukum yang mengikat.",
    en: "This result is advisory and does not replace an official determination. Every rule is cited; verification remains the professional user's responsibility. Not a binding legal document.",
  },
  disc_modal_title: { id: "Sebelum melanjutkan", en: "Before you continue" },
  disc_modal_accept: { id: "Saya mengerti, lanjutkan", en: "I understand, continue" },
  disc_modal_body1: {
    id: "Alat ini bersifat edukasi dan bukan fatwa atau putusan hukum yang mengikat. Perhitungan bersifat deterministik berdasarkan kaidah faraid yang dirujuk, namun kasus nyata dapat memuat detail yang tidak tercakup.",
    en: "This tool is educational and not a fatwa or binding legal ruling. The calculation is deterministic based on cited faraid rules, but a real case may contain details not covered here.",
  },
  disc_modal_body2: {
    id: "Untuk pembagian waris yang sah, konsultasikan dengan ustadz, notaris, atau PPAIW / Pengadilan Agama.",
    en: "For a valid estate division, consult an ustadz, notary, or PPAIW / Religious Court.",
  },
};

export const RULESET_LABELS_I18N: Record<Lang, Record<string, string>> = {
  id: {
    khi: "KHI (Kompilasi Hukum Islam)",
    syafii: "Syafi'i (klasik)",
    hanafi: "Hanafi (Beta)",
    maliki: "Maliki (Beta)",
    hanbali: "Hanbali (Beta)",
  },
  en: {
    khi: "KHI (Indonesian state law)",
    syafii: "Syafi'i (classical)",
    hanafi: "Hanafi (Beta)",
    maliki: "Maliki (Beta)",
    hanbali: "Hanbali (Beta)",
  },
};

export const RELATION_LABELS_I18N: Record<Lang, Record<string, string>> = {
  id: {
    suami: "Suami", istri: "Istri", anak_laki: "Anak laki-laki", anak_perempuan: "Anak perempuan",
    ayah: "Ayah", ibu: "Ibu", kakek: "Kakek (dari ayah)", nenek_ayah: "Nenek (dari ayah)",
    nenek_ibu: "Nenek (dari ibu)", cucu_laki: "Cucu laki-laki (dari anak laki)",
    cucu_perempuan: "Cucu perempuan (dari anak laki)", saudara_laki_kandung: "Saudara laki-laki kandung",
    saudari_kandung: "Saudari kandung", saudara_laki_seayah: "Saudara laki-laki seayah",
    saudari_seayah: "Saudari seayah", saudara_seibu: "Saudara/i seibu",
  },
  en: {
    suami: "Husband", istri: "Wife", anak_laki: "Son", anak_perempuan: "Daughter",
    ayah: "Father", ibu: "Mother", kakek: "Grandfather (paternal)", nenek_ayah: "Grandmother (paternal)",
    nenek_ibu: "Grandmother (maternal)", cucu_laki: "Grandson (via son)",
    cucu_perempuan: "Granddaughter (via son)", saudara_laki_kandung: "Full brother",
    saudari_kandung: "Full sister", saudara_laki_seayah: "Paternal brother",
    saudari_seayah: "Paternal sister", saudara_seibu: "Maternal sibling",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof STRINGS) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("id");
  const t = (key: keyof typeof STRINGS) => STRINGS[key]?.[lang] ?? String(key);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function relationLabel(labelId: string, lang: Lang): string {
  return RELATION_LABELS_I18N[lang][labelId] ?? labelId;
}
export function rulesetLabel(ruleset: string, lang: Lang): string {
  return RULESET_LABELS_I18N[lang][ruleset] ?? ruleset;
}
export function categoryLabel(category: string, t: I18nCtx["t"]): string {
  const map: Record<string, keyof typeof STRINGS> = {
    furud: "cat_furud", asabah: "cat_asabah", radd: "cat_radd",
    dzawil_arham: "cat_dzawil_arham", harta_bersama: "cat_harta_bersama",
  };
  return map[category] ? t(map[category]) : category;
}
