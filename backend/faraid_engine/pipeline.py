"""Top-level pipeline (PRD §5.2) — the engine's public entry point.

    from faraid_engine import calculate
    result = calculate(CalculationInput(...))

Runs the ordered pipeline: estate netting → (representation) → hajb → furud → asabah →
'aul/radd/dzawil arham, then assembles the fully-cited :class:`CalculationResult`,
including the non-skippable disclaimer (PRD §7) and any rule-set caveats.

No AI/LLM anywhere in this path (PRD §7) — pure deterministic functions.
"""

from __future__ import annotations

from decimal import Decimal
from fractions import Fraction

from .exceptions import EngineInvariantError
from .heirs import CalculationInput, Mode, Relation
from .results import (
    CalculationResult,
    HeirShare,
    ShareCategory,
)
from .rules.debts import deduct_debts
from .rules.derive import DeriveResult, derive
from .rules.representation import derive_with_representation
from .rulesets import get_config

_DISCLAIMER_PERSONAL = (
    "Ini adalah alat bantu edukasi, BUKAN fatwa atau putusan hukum. Untuk pembagian waris "
    "yang sah, konsultasikan dengan ustadz, notaris, atau PPAIW / Pengadilan Agama."
)
_DISCLAIMER_PROFESSIONAL = (
    "Hasil ini bersifat advisory dan tidak menggantikan penetapan resmi. Setiap kaidah yang "
    "diterapkan disertai rujukan; verifikasi tetap menjadi tanggung jawab pengguna profesional. "
    "Bukan dokumen hukum yang mengikat (mis. surat keterangan waris)."
)


def calculate(inp: CalculationInput) -> CalculationResult:
    inp.validate()
    config = get_config(inp.ruleset)

    # Steps 1–2 — net the estate (money only).
    debts_source = config.source_for("debts")
    hb_source = config.sources.get("harta_bersama") if inp.apply_harta_bersama else None
    breakdown, estate_steps = deduct_debts(
        inp.estate,
        debts_source,
        apply_harta_bersama=inp.apply_harta_bersama,
        harta_bersama_source=hb_source,
    )

    # Steps 3–8 — derive fractional shares (with representation if present).
    if inp.heirs.representatives:
        derived: DeriveResult = derive_with_representation(inp.heirs, config)
    else:
        derived = derive(inp.heirs, config)

    result = CalculationResult(
        ruleset=inp.ruleset,
        mode=inp.mode,
        estate=breakdown,
        pokok_masalah=derived.pokok_masalah,
        aul_applied=derived.aul_base is not None,
        aul_base=derived.aul_base,
        radd_applied=derived.radd_applied,
        beta=config.beta,
    )
    result.steps = estate_steps + derived.steps
    result.blocked = derived.blocked
    result.notes = list(derived.notes)
    result.shares = [a.to_heir_share() for a in derived.awards]

    # Harta bersama appears as an explicit pre-faraid spouse allocation in the shares view.
    if inp.apply_harta_bersama and breakdown.harta_bersama_deducted > 0:
        _append_harta_bersama_share(inp, result, breakdown.harta_bersama_deducted)

    if derived.baitul_mal_share > 0:
        result.notes.append(
            f"Sisa {derived.baitul_mal_share.numerator}/{derived.baitul_mal_share.denominator} "
            f"tidak terbagi kepada ahli waris dan secara klasik disalurkan ke baitul mal."
        )

    _verify_totals(result, derived)

    result.disclaimer = (
        _DISCLAIMER_PROFESSIONAL if inp.mode == Mode.PROFESSIONAL else _DISCLAIMER_PERSONAL
    )
    if config.beta:
        result.notes.insert(
            0,
            f"BETA — rule set {config.name} masih dalam validasi ilmiah dan belum boleh "
            f"dijadikan dasar pembagian final (PRD §4).",
        )
    return result


def _append_harta_bersama_share(inp, result, amount: Decimal) -> None:
    spouse_rel = Relation.HUSBAND if inp.heirs.husband else Relation.WIFE
    count = 1 if inp.heirs.husband else inp.heirs.wives
    result.shares.insert(
        0,
        HeirShare(
            relation=spouse_rel,
            count=count,
            share=Fraction(0),  # not a fraction of the faraid estate — a pre-faraid separation
            per_head=Fraction(0),
            category=ShareCategory.HARTA_BERSAMA,
            rule_applied="harta_bersama:0.5",
            reason=(
                f"Bagian harta bersama pasangan (di luar faraid): {amount}. Dipisahkan lebih "
                f"dulu sebelum harta warisan dibagi."
            ),
            source_id=result.steps[1].source_id or "khi-harta-bersama",
        ),
    )


def _verify_totals(result: CalculationResult, derived: DeriveResult) -> None:
    """Sanity invariant: faraid shares + baitul-mal residue must sum to exactly 1.

    A violation is an engine bug, not a user error — raise loudly (CLAUDE.md ledger bar).
    """
    total = result.total_share() + derived.baitul_mal_share
    if total != Fraction(1):
        raise EngineInvariantError(
            f"Awarded shares sum to {total}, not 1. Pokok masalah "
            f"{result.pokok_masalah}; this indicates a rule bug."
        )


__all__ = ["calculate"]
