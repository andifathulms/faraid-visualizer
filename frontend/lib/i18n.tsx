"use client";

// Frontend i18n (PRD §7: Bahasa Indonesia primary, English secondary).
//
// Derivation TEXT (reasons, labels, categories, step titles, notes, disclaimer) is
// localized server-side and returned already-translated per the `lang` sent with each
// request (single source of truth in the API layer). This module only supplies the
// static UI chrome (headings, buttons, form labels) and the form-time relation/ruleset
// labels shown before a calculation exists.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "id" | "en";

const LANG_KEY = "fv-lang";

type Dict = Record<string, { id: string; en: string }>;

export const STRINGS: Dict = {
  app_title: { id: "Faraid Visualizer", en: "Faraid Visualizer" },
  app_subtitle: {
    id: "Kalkulator waris Islam yang menunjukkan alasan setiap bagian, dengan rujukan.",
    en: "An Islamic inheritance calculator that shows the reason for every share, with sources.",
  },

  // Landing headline. The proposition has to survive a five-second read by someone who
  // has never heard of this tool, so it names the job (dividing an estate) before the
  // differentiator (the reasoning), and the lede carries the differentiator in full.
  // The three points below answer, in order, the three objections a stranger has to any
  // calculator that touches money and religion: is it a black box, on whose authority,
  // and where does my family's data go.
  hero_title: {
    id: "Hitung pembagian waris Islam — lengkap dengan alasan dan rujukannya",
    en: "Work out an Islamic inheritance — with the reasoning and the sources",
  },
  hero_lede: {
    id: "Bukan sekadar angka. Setiap bagian ditelusuri langkah demi langkah, dan setiap kaidah yang dipakai disertai rujukan ke Qur'an, hadits, atau Kompilasi Hukum Islam.",
    en: "Not just a number. Every share is traced step by step, and every rule applied carries a citation to the Qur'an, hadith, or Indonesian Islamic law (KHI).",
  },
  hero_pt_reasoning: { id: "Penurunan langkah demi langkah", en: "Step-by-step derivation" },
  hero_pt_cited: { id: "Setiap kaidah ada rujukannya", en: "Every rule cited" },
  hero_pt_private: { id: "Berjalan di perangkat Anda", en: "Runs on your device" },
  mode_personal: { id: "Personal", en: "Personal" },
  mode_professional: { id: "Profesional", en: "Professional" },
  app_tagline: { id: "Waris Islam, beserta alasannya", en: "Islamic inheritance, with the reasoning" },
  form_title: { id: "Ahli waris & harta", en: "Heirs & estate" },
  mode_hint_personal: { id: "Bahasa sederhana dengan penjelasan “kenapa”.", en: "Plain language with why-explanations." },
  mode_hint_professional: { id: "Derivasi lengkap, rujukan, ekspor PDF.", en: "Full derivation, citations, PDF export." },
  // The result pane is the largest thing on screen on a first visit. It used to say
  // "Ready to calculate" and repeat an instruction the adjacent form already implies —
  // procedure, in the one place with room to actually demonstrate the product. It now
  // shows a small worked sample instead, and the instruction sits under it.
  empty_title: { id: "Beginilah bentuk hasilnya", en: "This is what you'll get" },
  // Layout-agnostic: the form sits beside the result on desktop but above it on mobile.
  empty_body: { id: "Isi ahli waris dan harta peninggalan, lalu tekan Hitung untuk melihat pembagian beserta alasan dan rujukannya.", en: "Fill in the heirs and the estate, then press Calculate to see the shares with their reasoning and sources." },

  // Sample shown in the empty result pane. Not engine output — a static illustration of
  // the result vocabulary (category chip, fraction, gold citation chip, derivation step)
  // so none of it is a cold read when the real result arrives. The figures are a real,
  // correctly cited case (husband with children takes 1/4, QS 4:12; sons take the residue
  // as asabah, QS 4:11), because an illustration of a fiqh tool must not show fiqh that
  // is merely plausible. It is marked aria-hidden and captioned as a sample so it can
  // never be mistaken for a calculation the user asked for.
  preview_caption: {
    id: "Contoh tampilan, bukan hasil perhitungan Anda.",
    en: "A sample view, not your calculation.",
  },
  preview_heir_husband: { id: "Suami", en: "Husband" },
  preview_heir_sons: { id: "Anak laki-laki", en: "Sons" },
  preview_residue: { id: "sisa", en: "residue" },
  preview_step_title: { id: "Bagian tetap (furud) ditetapkan", en: "Fixed shares (furud) assigned" },
  preview_step_detail: {
    id: "Suami mendapat 1/4 karena almarhumah meninggalkan anak.",
    en: "The husband takes 1/4 because the deceased left children.",
  },
  // The form arrives pre-filled with a worked example. Unlabelled, a first-time visitor
  // reads it as either someone else's saved data or data they are expected to correct —
  // both cost seconds and trust on a page about a family's money. Labelled, the same seed
  // becomes the fastest possible onboarding: a case you can just press the button on.
  seed_badge: { id: "Contoh kasus", en: "Example case" },
  seed_badge_hint: {
    id: "Ubah sesuai keadaan Anda, atau tekan “Kasus baru” untuk mengosongkan.",
    en: "Edit it to match your situation, or press “New case” to start empty.",
  },

  theme: { id: "Tema", en: "Theme" },
  theme_system: { id: "Sistem", en: "System" },
  theme_light: { id: "Terang", en: "Light" },
  theme_dark: { id: "Gelap", en: "Dark" },
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
    id: "Mesin perhitungan gagal dimuat. Periksa koneksi Anda lalu muat ulang halaman.",
    en: "The calculation engine failed to load. Check your connection and reload the page.",
  },
  cannot_calc: { id: "Tidak dapat dihitung.", en: "Cannot be calculated." },
  export_pdf: { id: "Ekspor PDF", en: "Export PDF" },
  preparing: { id: "Menyiapkan…", en: "Preparing…" },

  // Unsupported configuration (CLAUDE.md: an unhandled case surfaces as an explicit
  // refusal, never a silently wrong number). Deliberately worded as a limit of the tool,
  // not as a user mistake, and visually distinct from a real error.
  unsupported_title: { id: "Konfigurasi ini belum didukung", en: "This configuration isn't supported yet" },
  unsupported_body: {
    id: "Mesin perhitungan sengaja berhenti daripada menebak. Kasus ini memerlukan kaidah yang belum diimplementasikan dan dirujuk. Silakan konsultasikan dengan ustadz atau Pengadilan Agama.",
    en: "The engine deliberately stops rather than guessing. This case needs a rule that has not yet been implemented and cited. Please consult an ustadz or the Religious Court.",
  },
  invalid_input_title: { id: "Masukan tidak valid", en: "Invalid input" },
  detail_technical: { id: "Detail teknis", en: "Technical detail" },

  // Live recalculation
  live_hint: { id: "Hasil diperbarui otomatis saat Anda mengubah masukan.", en: "Results update automatically as you change the inputs." },
  recalculate: { id: "Hitung ulang", en: "Recalculate" },
  updating: { id: "Memperbarui…", en: "Updating…" },
  view_result: { id: "Lihat hasil", en: "View result" },

  // Clearing the case. Worded as starting a new case rather than "reset"/"clear", which
  // reads as wiping the app; what it actually discards is one family's data.
  new_case: { id: "Kasus baru", en: "New case" },
  new_case_hint: {
    id: "Kosongkan ahli waris dan harta. Madzhab, mode, dan bahasa tetap.",
    en: "Empties the heirs and estate. Madhab, mode and language are kept.",
  },
  go_home: { id: "Beranda — mulai dari awal", en: "Home — start over" },
  need_heirs: {
    id: "Tambahkan minimal satu ahli waris untuk menghitung.",
    en: "Add at least one heir to calculate.",
  },

  // Sharing
  copy_link: { id: "Salin tautan", en: "Copy link" },
  copied: { id: "Tersalin", en: "Copied" },
  copy_link_hint: {
    id: "Menyalin tautan berisi ahli waris dan harta yang Anda masukkan — perhitungan tetap berjalan di perangkat penerima.",
    en: "Copies a link containing the heirs and estate you entered — the calculation still runs on the recipient's device.",
  },

  // Money
  per_person: { id: "per orang", en: "per person" },
  rounding_note: {
    id: "Setiap bagian dibulatkan ke sen secara terpisah, sehingga totalnya berbeda {diff} dari harta yang dibagi. Selisih ini tidak dibagikan ulang secara otomatis.",
    en: "Each share is rounded to the cent separately, so the total differs from the divisible estate by {diff}. This remainder is not redistributed automatically.",
  },
  inputs_used: { id: "Ahli waris yang dihitung", en: "Heirs calculated" },
  no_heirs_yet: { id: "Belum ada ahli waris", en: "No heirs yet" },
  section_empty: { id: "Tidak ada", en: "None" },

  // Engine boot status. The rule engine is real CPython compiled to WebAssembly and runs
  // in the browser, so the first load is a genuine multi-second download — say so plainly
  // rather than showing an unexplained spinner.
  engine_downloading: { id: "Mengunduh mesin perhitungan…", en: "Downloading the calculation engine…" },
  engine_starting: { id: "Menjalankan mesin perhitungan…", en: "Starting the calculation engine…" },
  engine_hint: {
    id: "Perhitungan berjalan sepenuhnya di perangkat Anda. Sekali diunduh, hasilnya seketika dan data Anda tidak pernah dikirim ke mana pun.",
    en: "Calculations run entirely on your device. Once downloaded it is instant, and your data is never sent anywhere.",
  },
  engine_error: { id: "Mesin perhitungan gagal dimuat.", en: "The calculation engine failed to load." },
  engine_retry: { id: "Coba lagi", en: "Try again" },
  pdf_preparing: { id: "Menyiapkan PDF…", en: "Preparing PDF…" },
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
  joint_assets: { id: "Total harta bersama (gono-gini)", en: "Total joint marital assets" },

  // Per-field help. These amounts mean different things and are NOT interchangeable —
  // a user who puts the estate total into the wrong one gets a result with no rupiah in
  // it at all and no indication why. Wording follows what the engine actually does
  // (faraid_engine/rules/debts.py) and cites the sources it already cites.
  what_is_this: { id: "Apa ini?", en: "What is this?" },
  estate_section_note: {
    id: "Opsional. Kosongkan jika Anda hanya ingin melihat pecahan bagian, bukan nominal rupiah.",
    en: "Optional. Leave empty if you only want the fractions rather than rupiah amounts.",
  },
  hint_gross: {
    id: "Seluruh harta yang ditinggalkan, sebelum dikurangi apa pun. Semua nominal rupiah di hasil dihitung dari angka ini.",
    en: "Everything the deceased left, before any deduction. Every rupiah figure in the result is derived from this.",
  },
  hint_funeral: {
    id: "Biaya pengurusan jenazah. Dikurangkan paling awal.",
    en: "Cost of preparing and burying the deceased. Deducted first.",
  },
  hint_debts: {
    id: "Utang almarhum yang belum lunas. Dikurangkan setelah biaya pemakaman.",
    en: "The deceased's unpaid debts. Deducted after funeral costs.",
  },
  hint_wasiyya: {
    id: "Wasiat untuk penerima yang bukan ahli waris. Otomatis dibatasi maksimal 1/3 dari sisa setelah utang (KHI Pasal 175).",
    en: "A bequest to someone who is not an heir. Automatically capped at 1/3 of what remains after debts (KHI Art. 175).",
  },
  hint_joint_assets: {
    id: "Harta yang diperoleh selama pernikahan — bukan total warisan. Setengahnya adalah hak pasangan yang masih hidup dan dipisahkan sebelum faraid (KHI Pasal 96–97).",
    en: "Property acquired during the marriage — not the total estate. Half belongs to the surviving spouse and is separated before faraid (KHI Art. 96–97).",
  },

  no_divisible_estate: {
    id: "Nominal rupiah tidak ditampilkan karena harta yang dibagi bernilai 0 setelah semua pengurangan. Periksa kembali “Nilai kotor”.",
    en: "No rupiah amounts are shown because the divisible estate is 0 after all deductions. Check “Gross value”.",
  },

  // Guards for the two ways this section silently produces nothing.
  warn_joint_without_gross: {
    id: "“Nilai kotor” masih kosong, jadi hasil tidak akan menampilkan nominal rupiah sama sekali. Isi total harta peninggalan di “Nilai kotor”.",
    en: "“Gross value” is still empty, so the result will show no rupiah amounts at all. Put the total estate into “Gross value”.",
  },
  warn_joint_not_applied: {
    id: "Harta bersama baru diperhitungkan setelah kotak di bawah dicentang.",
    en: "Joint assets are only applied once the box below is ticked.",
  },
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
  // Counterfactual sensitivity. Every string is a statement about a hypothetical
  // division, never an instruction — the app must not start telling people to go and
  // check whether a relative is alive, or rank heirs by how much they matter.
  sens_title: { id: "Apa yang mengubah hasil ini", en: "What would change this answer" },
  sens_lede: {
    id: "Setiap baris dihitung ulang secara utuh dengan satu ahli waris diubah — bukan perkiraan.",
    en: "Each row is the case fully recalculated with one heir changed — not an estimate.",
  },
  sens_run: { id: "Periksa", en: "Check" },
  sens_running: { id: "Menghitung…", en: "Working…" },
  sens_q_remove: { id: "Tanpa {heir}", en: "Without {heir}" },
  sens_q_add: { id: "Jika ada juga {heir}", en: "If there were also {heir}" },
  sens_none: { id: "tidak mewarisi", en: "does not inherit" },
  sens_no_change: { id: "tidak mengubah apa pun", en: "changes nothing" },
  sens_blocked_by: { id: "tidak mengubah apa pun — terhalang oleh {by}", en: "changes nothing — blocked by {by}" },
  sens_changes: { id: "{n} bagian berubah", en: "{n} shares move" },
  sens_refused: { id: "tidak dapat dihitung", en: "cannot be calculated" },
  sens_inert_head: { id: "Tidak mengubah hasil ({n})", en: "Changes nothing ({n})" },
  sens_changing_head: { id: "Mengubah hasil ({n})", en: "Changes the division ({n})" },
  sens_refused_head: { id: "Tidak dapat dihitung ({n})", en: "Cannot be calculated ({n})" },
  sens_foot: {
    id: "Daftar ini menjawab “bagaimana jika”, bukan anjuran untuk memeriksa keadaan siapa pun. Setiap angka di atas tetap berasal dari kaidah yang sama dan dapat ditelusuri.",
    en: "This answers “what if”, and is not a suggestion to go and verify anyone's circumstances. Every figure above comes from the same rules and remains traceable.",
  },

  // References page. sources.py was the first engine commit by design — uncited rules
  // don't ship — so the citations are the substrate results stand on, not decoration on
  // them. This page is where that substrate is legible without triggering a rule.
  ref_title: { id: "Rujukan & cakupan", en: "Sources & coverage" },
  ref_lede: {
    id: "Setiap kaidah yang dijalankan mesin ini memiliki rujukan. Berikut seluruh rujukan yang mendasarinya, beserta batas cakupannya.",
    en: "Every rule this engine fires carries a citation. Here is the whole basis it rests on, and where that basis stops.",
  },
  ref_back: { id: "Kembali ke kalkulator", en: "Back to the calculator" },
  ref_stat_sources: { id: "rujukan", en: "sources" },
  ref_gaps_lede: {
    id: "Batas cakupan per dasar hukum. Yang ditandai “tidak termasuk” tidak akan memberi peringatan otomatis saat menghitung.",
    en: "Coverage limits per legal basis. Anything marked “not included” will not warn you automatically at calculation time.",
  },
  // PRD §5.3 in one sentence, on the page where it matters most.
  ref_policy: {
    id: "Ayat Qur'an dan hadits dirujuk sebagai penunjuk (surah:ayat, perawi) — teksnya tidak pernah direproduksi di sini. Rujukan fiqh klasik dipakai untuk memeriksa isi kaidah, bukan untuk mengutip isinya.",
    en: "Qur'anic verses and hadith are cited as pointers (surah:ayah, narrator) — their text is never reproduced here. Classical fiqh references are used to cross-check the content of a rule, never to quote it.",
  },
  ref_type_quran: { id: "Qur'an", en: "Qur'an" },
  ref_type_hadith: { id: "Hadits", en: "Hadith" },
  ref_type_ijma: { id: "Ijma", en: "Consensus (ijma)" },
  ref_type_khi: { id: "KHI", en: "KHI" },
  ref_type_classical: { id: "Fiqh klasik & kontemporer", en: "Classical & contemporary fiqh" },
  ref_type_case_law: { id: "Praktik peradilan", en: "Court practice" },
  ref_type_note_quran: {
    id: "Tiga ayat al-mawarits, dirujuk sebagai penunjuk surah:ayat.",
    en: "The three ayat al-mawarith, cited as surah:ayah pointers.",
  },
  ref_type_note_hadith: {
    id: "Dirujuk beserta perawinya; matan tidak direproduksi.",
    en: "Cited with their narrator; the matn is not reproduced.",
  },
  ref_type_note_ijma: {
    id: "Titik yang disepakati lintas madzhab.",
    en: "Points settled across the schools.",
  },
  ref_type_note_khi: {
    id: "Kompilasi Hukum Islam, Inpres No. 1/1991, Buku II — hukum negara Indonesia.",
    en: "Kompilasi Hukum Islam, Inpres No. 1/1991, Book II — Indonesian state law.",
  },
  ref_type_note_classical: {
    id: "Dipakai untuk memeriksa isi kaidah, bukan untuk dikutip.",
    en: "Used to cross-check the content of a rule, not to quote it.",
  },
  ref_type_note_case_law: {
    id: "Praktik Pengadilan Agama yang membedakan penerapan KHI dari fiqh klasik.",
    en: "Religious Court practice where applied KHI departs from classical fiqh.",
  },

  // Coverage gaps. The engine raising on a shape it cannot resolve is visible; a doctrine
  // missing from an otherwise complete answer is not, and that is the one a user can never
  // discover by using the app. Worded as a limit of the tool, never as a caveat that
  // shifts responsibility onto the reader.
  coverage_title: { id: "Yang belum dihitung di sini", en: "Not covered here" },
  coverage_silent_lede: {
    id: "Hasil di atas tidak memuat hal berikut, dan tidak ada peringatan otomatis bila keadaan ini berlaku pada keluarga Anda:",
    en: "The result above does not include the following, and nothing warns you automatically if it applies to your family:",
  },
  coverage_announced_toggle: {
    id: "Lihat {n} kasus lain yang ditolak mesin",
    en: "Show {n} other cases the engine refuses",
  },
  coverage_announced_lede: {
    id: "Kasus berikut akan ditolak secara eksplisit saat dihitung — Anda tidak akan mendapat angka yang salah diam-diam:",
    en: "These are refused explicitly at calculation time — you will never get a silently wrong number for them:",
  },

  // Divergence notice. Worded so "they differ" reads as a fact about the two bodies of
  // law, never as the tool being unsure of its own arithmetic — both answers are exact,
  // and the point of PRD §4.1 is that there is no single "Islamic answer" to state.
  divergence_differs_title: {
    id: "Menurut {other}, pembagiannya berbeda",
    en: "Under {other}, this divides differently",
  },
  divergence_differs_body: {
    id: "Kasus ini termasuk yang membedakan {this} dan {other}. Keduanya dihitung pasti dan dirujuk — yang berbeda adalah kaidahnya, bukan ketelitiannya.",
    en: "This case is one where {this} and {other} part ways. Both are computed exactly and cited — what differs is the rule, not the precision.",
  },
  divergence_unsupported_title: {
    id: "{other} tidak dapat menyelesaikan kasus ini",
    en: "{other} cannot resolve this case",
  },
  divergence_unsupported_body: {
    id: "Mesin perhitungan menolak menebak untuk {other}, sehingga pembagian ini hanya berlaku menurut {this}.",
    en: "The engine refuses to guess under {other}, so this division holds under {this} only.",
  },
  divergence_hb_title: {
    id: "Pecahan sama, nominal berbeda",
    en: "Same fractions, different amounts",
  },
  divergence_hb_body: {
    id: "Pecahan bagiannya identik dengan {other}. Namun {this} memisahkan separuh harta bersama sebelum faraid, dan konsep itu tidak ada dalam fiqh klasik — sehingga nominal rupiahnya tetap berbeda.",
    en: "The fractions are identical to {other}. But {this} separates half the joint marital property before faraid, and classical fiqh has no such step — so the rupiah amounts still differ.",
  },
  divergence_see: { id: "Lihat berdampingan", en: "See side by side" },
  divergence_th_this: { id: "Menurut {rs}", en: "Under {rs}" },
  divergence_none: { id: "tidak mewarisi", en: "does not inherit" },

  // Siham working. The app already showed "pokok masalah 12" as a badge, which is the one
  // form of a faraid result a trained user does NOT verify against — what they check is
  // the siham column and its sum against the base. Professional mode only: it is the
  // verification artifact, not the answer.
  working_title: { id: "Perhitungan siham", en: "Siham working" },
  working_hint: {
    id: "Setiap bagian dinyatakan sebagai siham (bagian bulat) atas pokok masalah — bentuk yang dicocokkan dengan perhitungan manual.",
    en: "Each share expressed as siham (whole parts) over the base — the form you check a hand calculation against.",
  },
  th_siham: { id: "Siham", en: "Siham" },
  th_perhead_siham: { id: "Per orang", en: "Per person" },
  working_total: { id: "Jumlah", en: "Total" },
  working_aul_note: {
    id: "'Aul: pokok masalah {base} dinaikkan menjadi {aul}. Siham setiap ahli waris tidak berubah — yang berubah penyebutnya.",
    en: "'Aul: the base rises from {base} to {aul}. Each heir's siham are unchanged — it is the denominator that moves.",
  },
  working_radd_note: {
    id: "Radd: sisa dikembalikan kepada ahli waris berbagian tetap, sehingga pokok masalah menyusut menjadi {base}.",
    en: "Radd: the surplus returns to the fixed-share heirs, so the base contracts to {base}.",
  },
  working_unbalanced_note: {
    id: "Jumlah siham kurang dari pokok masalah — ada sisa yang tidak jatuh kepada ahli waris. Lihat Catatan.",
    en: "The siham total less than the base — part of the estate does not fall to an heir. See Notes.",
  },
  // Shown when a group's siham do not divide evenly among its members. The engine does not
  // perform tashih al-mas'alah (that would be a further derivation step needing its own
  // citation), so the exact fraction is reported rather than a rounded whole number.
  working_tashih_note: {
    id: "Siham yang tidak habis dibagi anggota kelompok ditampilkan sebagai pecahan apa adanya; penyamaan (tashih) tidak dilakukan otomatis.",
    en: "Siham that do not divide evenly within a group are shown as the exact fraction; tashih is not applied automatically.",
  },

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
  const [lang, setLangState] = useState<Lang>("id");

  // Read after mount, not in the useState initializer: the page is statically prerendered
  // (next.config.js `output: "export"`), so touching localStorage during render would be a
  // hydration mismatch. Mirrors lib/theme.tsx.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "id" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  // Keep <html lang> honest for screen readers and browser translation prompts.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

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
