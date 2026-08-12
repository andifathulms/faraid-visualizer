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

    # Group awards that hold ONE collective furud between them (see Award.aul_group).
    # The pokok masalah is the LCM of the denominators of the shares the RULES assign —
    # the grandmothers' 1/6 — not of the halves that 1/6 is displayed as. Splitting first
    # made the base 12 instead of 6 and produced ratios like 12->14, which the guard below
    # correctly rejected as impossible 'aul cases.
    groups: list[list[Award]] = []
    by_key: dict[str, list[Award]] = {}
    for a in awards:
        if a.aul_group is None:
            groups.append([a])
            continue
        if a.aul_group not in by_key:
            by_key[a.aul_group] = []
            groups.append(by_key[a.aul_group])
        by_key[a.aul_group].append(a)

    totals = [sum((a.share for a in g), Fraction(0)) for g in groups]

    base = 1
    for t in totals:
        base = _lcm(base, t.denominator)

    if total <= 1:
        return awards, base, None, None

    numerators = [t.numerator * (base // t.denominator) for t in totals]
    aul_base = sum(numerators)

    if base not in VALID_AUL or aul_base not in VALID_AUL[base]:
        raise EngineInvariantError(
            f"'Aul produced an invalid base {base}→{aul_base}. Valid 'aul cases are "
            f"{VALID_AUL}; reaching anything else indicates a rule bug, not a new case."
        )

    for group, t, n in zip(groups, totals, numerators):
        # The group holds n siham over the raised base; members keep the proportion they
        # had within the group, so a collective 1/6 shared by two grandmothers becomes a
        # collective 1/7 shared the same way.
        group_share = Fraction(n, aul_base)
        for a in group:
            a.share = group_share * (a.share / t) if len(group) > 1 else group_share
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
