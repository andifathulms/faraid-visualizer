"""Tier-2 madhab rule sets — Hanafi, Maliki, Hanbali (PRD §4, marked Beta).

These ship ONLY behind a Beta badge (``beta=True`` → the pipeline prepends a Beta note and
the UI shows the badge). They are NOT silent reuse of Syafi'i logic — each encodes the
citable divergences its school is known for on the heirs this engine models:

- Hanafi: the grandfather blocks siblings like the father (Abu Hanifa), unlike the
  muqasama schools; radd is accepted.
- Maliki: NO radd — surplus escheats to baitul mal (treated as an heir).
- Hanbali: radd accepted; grandfather + siblings uses Zaid's muqasama (not implemented →
  raises, same honest gap as classical Syafi'i).

Removing the Beta badge requires an equivalent validation pass (≥30 worked examples) per
madhab (CLAUDE.md build step 8) — not done yet, so the badge stays.
"""

from __future__ import annotations

from ..heirs import Ruleset
from .base import RuleSetConfig

# Furud shares are identical across the schools (same ayat al-mawarith); only the
# divergent rules get school-specific citations.
_SHARED_SOURCES = {
    "debts": "ijma-debts-first",
    "spouse": "quran-nisa-12",
    "son": "quran-nisa-11",
    "daughter": "quran-nisa-11",
    "granddaughter": "quran-nisa-11",
    "father": "quran-nisa-11",
    "mother": "quran-nisa-11",
    "grandfather": "hadith-grandfather-asabah",
    "grandmother": "hadith-grandmother-sixth",
    "full_sibling": "quran-nisa-176",
    "paternal_sibling": "quran-nisa-176",
    "maternal_sibling": "quran-nisa-12",
    "asabah": "hadith-asabah-ibn-abbas",
    "aul": "classical-aul-umar",
    "dzawil_arham": "classical-dzawil-arham",
}

# Maliki & Hanbali use Zaid's muqasama for grandfather + siblings; Hanafi blocks instead.
_MUQASAMA_SOURCE = {"jadd_muqasama": "jadd-muqasama-zaid"}


def _sources(**overrides: str) -> dict[str, str]:
    return {**_SHARED_SOURCES, **overrides}


HANAFI = RuleSetConfig(
    key=Ruleset.HANAFI,
    name="Hanafi",
    beta=True,
    supports_representation=False,
    supports_harta_bersama=False,
    grandfather_blocks_siblings=True,   # Abu Hanifa: grandfather blocks like the father
    radd_includes_spouse_when_sole=False,
    dzawil_arham_distributed=True,
    applies_radd=True,
    sources=_sources(
        grandfather="hanafi-jadd-blocks-siblings",
        radd="radd-hanafi-hanbali",
    ),
)

MALIKI = RuleSetConfig(
    key=Ruleset.MALIKI,
    name="Maliki",
    beta=True,
    supports_representation=False,
    supports_harta_bersama=False,
    grandfather_blocks_siblings=False,  # muqasama (Zaid) — not implemented → raises
    radd_includes_spouse_when_sole=False,
    dzawil_arham_distributed=False,     # baitul mal
    applies_radd=False,                 # Maliki rejects radd
    sources=_sources(radd="maliki-no-radd", **_MUQASAMA_SOURCE),
)

HANBALI = RuleSetConfig(
    key=Ruleset.HANBALI,
    name="Hanbali",
    beta=True,
    supports_representation=False,
    supports_harta_bersama=False,
    grandfather_blocks_siblings=False,  # muqasama (Zaid) — not implemented → raises
    radd_includes_spouse_when_sole=False,
    dzawil_arham_distributed=True,
    applies_radd=True,
    sources=_sources(radd="radd-hanafi-hanbali", **_MUQASAMA_SOURCE),
)
