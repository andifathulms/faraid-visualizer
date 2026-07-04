"""Bilingual presentation labels & disclaimers (PRD §7: BI primary, EN secondary).

The engine emits authoritative Indonesian prose. This module is the SINGLE server-side
source of truth for localized UI text — relation/ruleset/category labels, step titles,
disclaimers — shared by the JSON serializer and the PDF export so both stay consistent
and an English PDF is a first-class artifact. English derivation *reasons* are generated
in :mod:`api.explain` from the engine's structured fields.
"""

from __future__ import annotations

Lang = str  # "id" | "en"

RELATION_LABELS: dict[Lang, dict[str, str]] = {
    "id": {
        "suami": "Suami", "istri": "Istri", "anak_laki": "Anak laki-laki",
        "anak_perempuan": "Anak perempuan", "ayah": "Ayah", "ibu": "Ibu",
        "kakek": "Kakek (dari ayah)", "nenek_ayah": "Nenek (dari ayah)",
        "nenek_ibu": "Nenek (dari ibu)", "cucu_laki": "Cucu laki-laki (dari anak laki)",
        "cucu_perempuan": "Cucu perempuan (dari anak laki)",
        "saudara_laki_kandung": "Saudara laki-laki kandung", "saudari_kandung": "Saudari kandung",
        "saudara_laki_seayah": "Saudara laki-laki seayah", "saudari_seayah": "Saudari seayah",
        "saudara_seibu": "Saudara/i seibu",
    },
    "en": {
        "suami": "Husband", "istri": "Wife", "anak_laki": "Son", "anak_perempuan": "Daughter",
        "ayah": "Father", "ibu": "Mother", "kakek": "Grandfather (paternal)",
        "nenek_ayah": "Grandmother (paternal)", "nenek_ibu": "Grandmother (maternal)",
        "cucu_laki": "Grandson (via son)", "cucu_perempuan": "Granddaughter (via son)",
        "saudara_laki_kandung": "Full brother", "saudari_kandung": "Full sister",
        "saudara_laki_seayah": "Paternal brother", "saudari_seayah": "Paternal sister",
        "saudara_seibu": "Maternal sibling",
    },
}

RULESET_LABELS: dict[Lang, dict[str, str]] = {
    "id": {
        "khi": "KHI (Kompilasi Hukum Islam)", "syafii": "Syafi'i (klasik)",
        "hanafi": "Hanafi (Beta)", "maliki": "Maliki (Beta)", "hanbali": "Hanbali (Beta)",
    },
    "en": {
        "khi": "KHI (Indonesian state law)", "syafii": "Syafi'i (classical)",
        "hanafi": "Hanafi (Beta)", "maliki": "Maliki (Beta)", "hanbali": "Hanbali (Beta)",
    },
}

CATEGORY_LABELS: dict[Lang, dict[str, str]] = {
    "id": {
        "furud": "Bagian tetap (furud)", "asabah": "Sisa (asabah)", "radd": "Radd",
        "dzawil_arham": "Dzawil arham", "harta_bersama": "Harta bersama",
    },
    "en": {
        "furud": "Fixed share (furud)", "asabah": "Residuary (asabah)", "radd": "Radd (return)",
        "dzawil_arham": "Distant kindred", "harta_bersama": "Joint property",
    },
}

STEP_TITLES: dict[Lang, dict[str, str]] = {
    "id": {},  # Indonesian titles come straight from the engine.
    "en": {
        "debts": "Settlement of obligations on the estate",
        "harta_bersama": "Separation of joint marital property",
        "hajb": "Blocking (hajb)",
        "furud": "Fixed shares (furud muqaddarah)",
        "asabah": "Residuary distribution (asabah)",
        "jadd_muqasama": "Grandfather with siblings (muqasama)",
        "aul": "'Aul — proportional reduction",
        "radd": "Radd — return of surplus",
        "representation": "Substitute heirs (KHI Art. 185)",
    },
}

DISCLAIMER: dict[Lang, dict[str, str]] = {
    "id": {
        "personal": (
            "Ini adalah alat bantu edukasi, BUKAN fatwa atau putusan hukum. Untuk pembagian "
            "waris yang sah, konsultasikan dengan ustadz, notaris, atau PPAIW / Pengadilan Agama."
        ),
        "professional": (
            "Hasil ini bersifat advisory dan tidak menggantikan penetapan resmi. Setiap kaidah "
            "disertai rujukan; verifikasi tetap tanggung jawab pengguna profesional. Bukan "
            "dokumen hukum yang mengikat."
        ),
    },
    "en": {
        "personal": (
            "This is an educational tool, NOT a fatwa or legal ruling. For a valid estate "
            "division, consult an ustadz, notary, or PPAIW / Religious Court."
        ),
        "professional": (
            "This result is advisory and does not replace an official determination. Every rule "
            "is cited; verification remains the professional user's responsibility. Not a "
            "binding legal document."
        ),
    },
}

# PDF section headings.
PDF_TEXT: dict[Lang, dict[str, str]] = {
    "id": {
        "doc_title": "Perhitungan Waris (Faraid)",
        "legal_basis": "Dasar hukum", "mode_pro": "Mode Profesional", "base": "Pokok masalah",
        "heirs_entered": "Ahli waris yang dimasukkan", "divisible": "Harta yang dibagi",
        "distribution": "Pembagian", "th_heir": "Ahli waris", "th_share": "Bagian",
        "th_perhead": "Per orang", "th_category": "Kategori", "th_amount": "Jumlah",
        "reasoning": "Alasan & dasar tiap bagian", "blocked": "Terhalang (hajb)",
        "steps": "Langkah penurunan", "notes": "Catatan", "references": "Daftar rujukan",
        "beta": "BETA — rule set ini masih dalam validasi ilmiah.",
    },
    "en": {
        "doc_title": "Islamic Inheritance (Faraid) Calculation",
        "legal_basis": "Legal basis", "mode_pro": "Professional mode", "base": "Base",
        "heirs_entered": "Heirs entered", "divisible": "Divisible estate",
        "distribution": "Distribution", "th_heir": "Heir", "th_share": "Share",
        "th_perhead": "Per person", "th_category": "Category", "th_amount": "Amount",
        "reasoning": "Reason & basis for each share", "blocked": "Blocked (hajb)",
        "steps": "Derivation steps", "notes": "Notes", "references": "References",
        "beta": "BETA — this rule set is still under scholarly validation.",
    },
}


def relation_label(label_id: str, lang: Lang) -> str:
    return RELATION_LABELS.get(lang, RELATION_LABELS["id"]).get(label_id, label_id)


def ruleset_label(key: str, lang: Lang) -> str:
    return RULESET_LABELS.get(lang, RULESET_LABELS["id"]).get(key, key)


def category_label(cat: str, lang: Lang) -> str:
    return CATEGORY_LABELS.get(lang, CATEGORY_LABELS["id"]).get(cat, cat)


def step_title(step_type: str, engine_title: str, lang: Lang) -> str:
    if lang == "en":
        return STEP_TITLES["en"].get(step_type, engine_title)
    return engine_title


def disclaimer(mode: str, lang: Lang) -> str:
    return DISCLAIMER.get(lang, DISCLAIMER["id"]).get(mode, DISCLAIMER["id"]["personal"])


def pdf_text(key: str, lang: Lang) -> str:
    return PDF_TEXT.get(lang, PDF_TEXT["id"]).get(key, key)
