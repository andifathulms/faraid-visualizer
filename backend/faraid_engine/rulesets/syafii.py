"""Classical Syafi'i rule set (Tier 1).

Undiluted classical fiqh — NO KHI state-law additions (PRD §4.1). No representation,
no harta bersama; surplus with no residuary routes to baitul mal (radd excludes the
spouse in the majority Sunni view).
"""

from __future__ import annotations

from ..heirs import Ruleset
from .base import RuleSetConfig

SYAFII = RuleSetConfig(
    key=Ruleset.SYAFII,
    name="Syafi'i (klasik)",
    beta=False,
    supports_representation=False,
    supports_harta_bersama=False,
    grandfather_blocks_siblings=False,  # al-jadd wal-ikhwah not implemented → raise
    radd_includes_spouse_when_sole=False,
    dzawil_arham_distributed=False,  # route residue to baitul mal
    sources={
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
        "radd": "classical-radd-syafii",
        "dzawil_arham": "classical-dzawil-arham",
    },
)
