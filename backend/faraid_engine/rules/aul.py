"""PRD §5.2 step 6: 'aul (proportional reduction when shares exceed the estate).

When the fixed shares sum to more than 1, the pokok masalah (base = LCM of denominators)
is raised to the sum of the share numerators, and every heir's numerator is held constant
over the larger base — reducing all shares proportionally.

Only these bases are mathematically valid (PRD §5.2 step 6): 6→{7,8,9,10}, 12→{13,15,17},
24→{27}. Anything else is an engine bug, so :func:`apply_aul` raises
:class:`EngineInvariantError` rather than inventing a new 'aul case.
"""

from __future__ import annotations

from fractions import Fraction
from math import gcd

from ..exceptions import EngineInvariantError
from ..results import DerivationStep
from .awards import Award

VALID_AUL = {6: {7, 8, 9, 10}, 12: {13, 15, 17}, 24: {27}}


def _lcm(a: int, b: int) -> int:
    return a * b // gcd(a, b)


def apply_aul(
    awards: list[Award], source: str
) -> tuple[list[Award], int, int | None, DerivationStep | None]:
    """Return ``(awards, pokok_masalah, aul_base, step)``.

    If shares do not exceed 1, ``aul_base`` is ``None`` and the awards are unchanged.
    """
    total = sum((a.share for a in awards), Fraction(0))
    base = 1
    for a in awards:
        base = _lcm(base, a.share.denominator)

    if total <= 1:
        return awards, base, None, None

    numerators = [a.share.numerator * (base // a.share.denominator) for a in awards]
    aul_base = sum(numerators)

    if base not in VALID_AUL or aul_base not in VALID_AUL[base]:
        raise EngineInvariantError(
            f"'Aul produced an invalid base {base}→{aul_base}. Valid 'aul cases are "
            f"{VALID_AUL}; reaching anything else indicates a rule bug, not a new case."
        )

    for a, n in zip(awards, numerators):
        a.share = Fraction(n, aul_base)
        a.reason += f" (dikurangi proporsional karena 'aul: {base}→{aul_base})."
        a.rule_applied += f"|aul:{base}->{aul_base}"

    step = DerivationStep(
        step="aul",
        title="'Aul — pengurangan proporsional",
        # The arithmetic, not just the outcome. "Pokok masalah dinaikkan menjadi 7"
        # states what happened; the reader still cannot see WHY 7 without the sum that
        # overshot the base, which is the whole content of 'aul.
        detail=(
            f"Atas pokok masalah {base}, bagian-bagian tetap berjumlah "
            f"{' + '.join(str(n) for n in numerators)} = {aul_base} bagian — lebih besar "
            f"dari {base}, sehingga harta tidak cukup. Pokok masalah dinaikkan menjadi "
            f"{aul_base}: setiap ahli waris tetap memegang jumlah bagian yang sama, tetapi "
            f"kini dihitung atas {aul_base}, sehingga totalnya kembali menjadi 1."
        ),
        source_id=source,
        data={"pokok_masalah": base, "aul_base": aul_base, "siham": numerators},
    )
    return awards, base, aul_base, step
