"""KHI rule set (Tier 1) — Kompilasi Hukum Islam, Inpres No. 1/1991, Buku II.

Indonesian state law. Diverges from classical Syafi'i on load-bearing points (PRD §4.1):
representation (ahli waris pengganti, Pasal 185), harta bersama, and — in current
Pengadilan Agama practice — applying radd/dzawil arham distribution rather than escheat
to a (non-functioning) baitul mal.
"""

from __future__ import annotations

from ..heirs import Ruleset
from .base import RuleSetConfig

KHI = RuleSetConfig(
    key=Ruleset.KHI,
    name="KHI (Kompilasi Hukum Islam)",
    beta=False,
    supports_representation=True,       # Pasal 185
    supports_harta_bersama=True,        # Pasal 96–97 (optional toggle)
    grandfather_blocks_siblings=True,   # KHI treats kakek analogously to ayah
    radd_includes_spouse_when_sole=True,  # PA practice when spouse is the only heir
    dzawil_arham_distributed=True,      # PA practice favors distribution over baitul mal
    sources={
        "debts": "khi-175",
        "spouse": "khi-179",  # duda; wife side resolved to khi-180 in the rule
        "husband": "khi-179",
        "wife": "khi-180",
        "son": "khi-176",
        "daughter": "khi-176",
        "granddaughter": "khi-176",
        "father": "khi-177",
        "mother": "khi-178",
        "grandfather": "hadith-grandfather-asabah",
        "grandmother": "hadith-grandmother-sixth",
        "full_sibling": "khi-182",
        "paternal_sibling": "khi-182",
        "maternal_sibling": "khi-181",
        "asabah": "hadith-asabah-ibn-abbas",
        "aul": "khi-192",
        "radd": "khi-193",
        "dzawil_arham": "khi-practice-baitul-mal",
        "harta_bersama": "khi-harta-bersama",
        "representation": "khi-185",
    },
)
