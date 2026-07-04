"""al-jadd wa al-ikhwah — the grandfather competing with siblings (Zaid's muqasama).

Used by Maliki/Syafi'i/Hanbali (Hanafi instead blocks siblings with the grandfather, like
the father). Reached only when: a paternal grandfather is present, no father, full OR
paternal siblings survive hajb, and there is no descendant.

The grandfather takes the BEST for him of:
  (a) muqasama — sharing the residue as though he were a brother (2:1 vs sisters),
  (b) 1/3 of the residue (when ashabul furud have taken fixed shares),
  (c) 1/6 of the whole estate (a floor when ashabul furud are present).
The siblings split whatever remains 2:1.

Intricate sub-cases are NOT implemented and raise (CLAUDE.md — raise, don't guess):
  - akdariyya (grandfather + a lone sister alongside a spouse),
  - mu'adda (mixing full and paternal siblings against the grandfather),
  - any descendant present alongside grandfather + siblings.
"""

from __future__ import annotations

from fractions import Fraction

from ..exceptions import UnsupportedConfiguration
from ..heirs import Heirs, Relation
from ..results import AsabahType, DerivationStep, ShareCategory
from ..rulesets.base import RuleSetConfig
from .awards import Award

R = Relation
_FULL = (R.FULL_BROTHER, R.FULL_SISTER)
_PAT = (R.PATERNAL_BROTHER, R.PATERNAL_SISTER)


def applies(heirs: Heirs, present: dict[Relation, int], config: RuleSetConfig) -> bool:
    return (
        not config.grandfather_blocks_siblings
        and heirs.paternal_grandfather
        and not heirs.father
        and any(present[r] for r in (*_FULL, *_PAT))
    )


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def resolve(
    present: dict[Relation, int],
    residue: Fraction,
    has_furud: bool,
    config: RuleSetConfig,
) -> tuple[list[Award], list[DerivationStep]]:
    """Split ``residue`` between the grandfather and one sibling class via muqasama.

    Guards raise for the unimplemented sub-cases. ``has_furud`` indicates whether any
    ashabul furud took a fixed share (enables the 1/3-of-remainder and 1/6-floor options).
    """
    full = present[R.FULL_BROTHER] + present[R.FULL_SISTER]
    pat = present[R.PATERNAL_BROTHER] + present[R.PATERNAL_SISTER]
    if full and pat:
        raise UnsupportedConfiguration(
            "Grandfather with BOTH full and paternal siblings (mu'adda) is not implemented "
            "— this intricate sub-case should be reviewed by an ustadz.",
            ruleset=config.key.value,
        )

    if full:
        brothers, sisters = present[R.FULL_BROTHER], present[R.FULL_SISTER]
        bro_rel, sis_rel, cls_source = R.FULL_BROTHER, R.FULL_SISTER, config.source_for("full_sibling")
    else:
        brothers, sisters = present[R.PATERNAL_BROTHER], present[R.PATERNAL_SISTER]
        bro_rel, sis_rel, cls_source = R.PATERNAL_BROTHER, R.PATERNAL_SISTER, config.source_for("paternal_sibling")

    # akdariyya guard: a lone sister class with a spouse present is the intricate case.
    if brothers == 0 and (present[R.HUSBAND] or present[R.WIFE]):
        raise UnsupportedConfiguration(
            "Grandfather with sisters (no brothers) alongside a spouse can trigger the "
            "akdariyya case, which is not implemented — please consult an ustadz.",
            ruleset=config.key.value,
        )

    muq_source = config.source_for("jadd_muqasama")

    heads = 2 * brothers + sisters + 2  # grandfather counts as a brother (2 heads)
    muqasama = residue * Fraction(2, heads)
    candidates = [muqasama]
    if has_furud:
        candidates.append(residue * Fraction(1, 3))
        candidates.append(Fraction(1, 6))
    else:
        candidates.append(residue * Fraction(1, 3))
    grandfather_share = max(candidates)
    if grandfather_share > residue:
        grandfather_share = residue  # never exceed what is available

    which = (
        "muqasama (dibagi sebagai saudara)" if grandfather_share == muqasama
        else "1/6 dari seluruh harta" if grandfather_share == Fraction(1, 6)
        else "1/3 dari sisa"
    )

    awards = [
        Award(
            relation=R.PATERNAL_GRANDFATHER, count=1, share=grandfather_share,
            category=ShareCategory.ASABAH, rule_applied="jadd_muqasama:grandfather",
            reason=f"Kakek bersama saudara mengambil bagian terbaik baginya ({which}) = "
                   f"{_frac(grandfather_share)}.",
            source_id=muq_source, asabah_type=AsabahType.BINAFSIHI,
        )
    ]

    sib_residue = residue - grandfather_share
    sib_heads = 2 * brothers + sisters
    if sib_heads > 0 and sib_residue > 0:
        unit = sib_residue / sib_heads
        if brothers:
            awards.append(Award(
                relation=bro_rel, count=brothers, share=unit * 2 * brothers,
                category=ShareCategory.ASABAH, rule_applied="jadd_muqasama:brother",
                reason="Sisa dibagi bersama kakek secara muqasama (2:1).",
                source_id=cls_source, asabah_type=AsabahType.BINAFSIHI,
            ))
        if sisters:
            awards.append(Award(
                relation=sis_rel, count=sisters, share=unit * sisters,
                category=ShareCategory.ASABAH, rule_applied="jadd_muqasama:sister",
                reason="Menjadi asabah bersama kakek secara muqasama (2:1).",
                source_id=cls_source,
                asabah_type=AsabahType.BIGHAIRIHI if brothers else AsabahType.MAAGHAIRIHI,
            ))

    steps = [DerivationStep(
        step="jadd_muqasama", title="Kakek bersama saudara (muqasama)",
        detail=f"Kakek mengambil {which} = {_frac(grandfather_share)}; sisa "
               f"{_frac(sib_residue)} dibagi kepada saudara (2:1).",
        source_id=muq_source,
        data={"grandfather": _frac(grandfather_share), "method": which},
    )]
    return awards, steps
