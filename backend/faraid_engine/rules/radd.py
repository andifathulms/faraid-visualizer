"""PRD §5.2 step 7: radd (returning surplus to fixed-share heirs).

Reached when fixed shares total less than the estate AND no asabah exists. The surplus
is returned proportionally to the ashabul furud. The spouse is excluded from radd in the
majority Sunni view (PRD §5.2 step 7 — flagged as rule-set dependent):

- classical Syafi'i: if the spouse is the only fixed-share heir, the surplus escheats to
  baitul mal (spouse gets only the fixed share).
- KHI practice: with no functioning baitul mal, a sole surviving spouse takes the surplus
  by radd (PRD §4.1).
"""

from __future__ import annotations

from fractions import Fraction

from ..heirs import Relation
from ..results import DerivationStep, ShareCategory
from ..rulesets.base import RuleSetConfig
from .awards import Award

_SPOUSE = {Relation.HUSBAND, Relation.WIFE}


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def apply_radd(
    awards: list[Award], config: RuleSetConfig
) -> tuple[list[Award], bool, Fraction, list[DerivationStep]]:
    """Return ``(awards, radd_applied, baitul_mal_share, steps)``.

    ``baitul_mal_share`` is the surplus routed to baitul mal (classical Syafi'i,
    spouse-only case); 0 otherwise.
    """
    steps: list[DerivationStep] = []
    total = sum((a.share for a in awards), Fraction(0))
    surplus = Fraction(1) - total
    if surplus <= 0:
        return awards, False, Fraction(0), steps

    source = config.source_for("radd")

    # Maliki: no radd at all — the surplus escheats to baitul mal, treated as an heir.
    if not config.applies_radd:
        steps.append(
            DerivationStep(
                step="radd", title="Tanpa radd — sisa ke baitul mal",
                detail=f"Madhab ini tidak menerapkan radd; sisa {_frac(surplus)} disalurkan "
                "ke baitul mal (baitul mal dipandang sebagai penerima).",
                source_id=source,
            )
        )
        return awards, False, surplus, steps

    non_spouse = [a for a in awards if a.relation not in _SPOUSE]
    spouse = [a for a in awards if a.relation in _SPOUSE]

    if not non_spouse:
        # Only the spouse holds a fixed share.
        if config.radd_includes_spouse_when_sole and spouse:
            for a in spouse:
                a.share = a.share + surplus  # sole spouse absorbs everything
                a.reason += f" Ditambah radd karena menjadi satu-satunya ahli waris = {_frac(a.share)}."
                a.rule_applied += "|radd:spouse-sole"
            steps.append(
                DerivationStep(
                    step="radd", title="Radd kepada pasangan (praktik KHI)",
                    detail="Karena tidak ada ahli waris lain dan baitul mal tidak berfungsi "
                    "sebagai penerima, seluruh sisa dikembalikan (radd) kepada pasangan.",
                    source_id=config.source_for("dzawil_arham"),
                )
            )
            return awards, True, Fraction(0), steps
        # Classical: surplus escheats to baitul mal.
        steps.append(
            DerivationStep(
                step="radd", title="Sisa ke baitul mal",
                detail=f"Pasangan tidak menerima radd (pendapat mayoritas). Sisa {_frac(surplus)} "
                "disalurkan ke baitul mal.",
                source_id=source,
            )
        )
        return awards, False, surplus, steps

    # Redistribute surplus to non-spouse fixed-share heirs, proportional to their shares.
    base_total = sum((a.share for a in non_spouse), Fraction(0))
    # Captured before the loop mutates the shares — the reader needs the BEFORE figures
    # to see what was redistributed and in what proportion.
    before = [(a.relation.display, _frac(a.share)) for a in non_spouse]
    for a in non_spouse:
        addition = surplus * (a.share / base_total)
        a.share = a.share + addition
        a.category = ShareCategory.RADD
        a.reason += f" Ditambah radd proporsional menjadi {_frac(a.share)}."
        a.rule_applied += "|radd"
    # Show the shortfall and the proportion it is shared in, not only the outcome.
    detail = (
        f"Bagian tetap berjumlah {' + '.join(f for _, f in before)} = {_frac(base_total)}, "
        f"kurang dari harta yang ada, dan tidak ada ahli waris asabah yang mengambil "
        f"sisanya. Sisa {_frac(surplus)} dikembalikan (radd) kepada ahli waris berbagian "
        f"tetap selain pasangan, dibagi menurut perbandingan bagian mereka "
        f"({' : '.join(f for _, f in before)})."
    )
    if spouse:
        detail += " Bagian pasangan tetap dan tidak ikut radd."
    steps.append(DerivationStep(step="radd", title="Radd — pengembalian sisa", detail=detail, source_id=source))
    return awards, True, Fraction(0), steps
