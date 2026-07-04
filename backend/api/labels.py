"""Bahasa Indonesia display labels for the PDF (mirrors frontend/lib/labels.ts).

Keyed by the engine's ``Relation.label_id`` so the backend can render human-readable
names without the engine carrying UI text.
"""

from __future__ import annotations

RELATION_LABELS: dict[str, str] = {
    "suami": "Suami",
    "istri": "Istri",
    "anak_laki": "Anak laki-laki",
    "anak_perempuan": "Anak perempuan",
    "ayah": "Ayah",
    "ibu": "Ibu",
    "kakek": "Kakek (dari ayah)",
    "nenek_ayah": "Nenek (dari ayah)",
    "nenek_ibu": "Nenek (dari ibu)",
    "cucu_laki": "Cucu laki-laki (dari anak laki)",
    "cucu_perempuan": "Cucu perempuan (dari anak laki)",
    "saudara_laki_kandung": "Saudara laki-laki kandung",
    "saudari_kandung": "Saudari kandung",
    "saudara_laki_seayah": "Saudara laki-laki seayah",
    "saudari_seayah": "Saudari seayah",
    "saudara_seibu": "Saudara/i seibu",
}

RULESET_LABELS: dict[str, str] = {
    "khi": "KHI (Kompilasi Hukum Islam)",
    "syafii": "Syafi'i (klasik)",
    "hanafi": "Hanafi (Beta)",
    "maliki": "Maliki (Beta)",
    "hanbali": "Hanbali (Beta)",
}
