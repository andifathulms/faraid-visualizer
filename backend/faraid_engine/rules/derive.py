"""Core share derivation: PRD §5.2 steps 3–8 on a set of living heirs.

Separated from the top-level pipeline so representation (KHI pengganti) can run the same
derivation on an augmented heir set. Operates purely on fractions — no estate money, no
representation. Given living heirs + a ruleset config, returns the awarded shares, the
blocking list, and the ordered derivation steps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

from ..exceptions import UnsupportedConfiguration
from ..heirs import Heirs, Relation
from ..results import DerivationStep, HajbEntry
from ..rulesets.base import RuleSetConfig
from .asabah import compute_asabah
from .aul import apply_aul
from .awards import Award
from .dzawil_arham import resolve_dzawil_arham
from .furud import compute_furud
from .hajb import apply_hajb
from .jadd_ikhwah import applies as jadd_applies
from .jadd_ikhwah import resolve as jadd_resolve
from .radd import apply_radd

_SIBLINGS = {
    Relation.FULL_BROTHER, Relation.FULL_SISTER,
    Relation.PATERNAL_BROTHER, Relation.PATERNAL_SISTER,
    Relation.MATERNAL_SIBLING,
}


@dataclass
class DeriveResult:
    awards: list[Award]
    blocked: list[HajbEntry]
    steps: list[DerivationStep]
    notes: list[str]
    present: dict[Relation, int]
    pokok_masalah: int = 1
    aul_base: int | None = None
    radd_applied: bool = False
    baitul_mal_share: Fraction = field(default_factory=lambda: Fraction(0))


def derive(heirs: Heirs, config: RuleSetConfig) -> DeriveResult:
    steps: list[DerivationStep] = []

    # Step 3 — hajb.
    present, blocked = apply_hajb(heirs, config)

    steps.append(
        DerivationStep(
            step="hajb",
            title="Penghalangan (hajb)",
            detail=(
                "Ahli waris yang terhalang: "
                + (", ".join(f"{b.relation.label_id} (oleh {b.blocked_by.label_id})" for b in blocked)
                   if blocked else "tidak ada.")
            ),
            data={"blocked": [b.relation.value for b in blocked]},
        )
    )

    # al-jadd wa al-ikhwah (Maliki/Syafi'i/Hanbali): the grandfather competes with siblings
    # via Zaid's muqasama instead of taking a plain residuary share.
    if jadd_applies(heirs, present, config):
        return _derive_jadd_ikhwah(heirs, present, blocked, steps, config)

    # Step 4 — furud.
    furud_awards, extra_blocked, notes = compute_furud(heirs, present, config)
    blocked.extend(extra_blocked)
    if furud_awards:
        steps.append(
            DerivationStep(
                step="furud", title="Bagian tetap (furud muqaddarah)",
                detail="; ".join(a.reason for a in furud_awards),
            )
        )

    # Step 5 — asabah.
    awards, asabah_steps, asabah_assigned, residue = compute_asabah(
        heirs, present, furud_awards, config
    )
    steps.extend(asabah_steps)

    result = DeriveResult(
        awards=awards, blocked=blocked, steps=steps, notes=notes, present=present
    )

    # Steps 6–8 — 'aul / radd / dzawil arham.
    if residue < 0:  # shares exceed the estate
        awards, pokok, aul_base, aul_step = apply_aul(awards, config.source_for("aul"))
        result.awards = awards
        result.pokok_masalah = pokok
        result.aul_base = aul_base
        if aul_step:
            steps.append(aul_step)
    elif residue > 0 and not asabah_assigned:
        if not awards:
            resolve_dzawil_arham(config)  # raises UnsupportedConfiguration
        awards, radd_applied, baitul_mal, radd_steps = apply_radd(awards, config)
        result.awards = awards
        result.radd_applied = radd_applied
        result.baitul_mal_share = baitul_mal
        steps.extend(radd_steps)

    result.pokok_masalah = _pokok(result.awards, result.pokok_masalah)
    return result


def _pokok(awards: list[Award], existing: int = 1) -> int:
    if existing != 1:
        return existing
    from math import gcd

    base = 1
    for a in awards:
        d = a.share.denominator
        base = base * d // gcd(base, d)
    return base


def _derive_jadd_ikhwah(
    heirs: Heirs,
    present: dict[Relation, int],
    blocked: list[HajbEntry],
    steps: list[DerivationStep],
    config: RuleSetConfig,
) -> DeriveResult:
    """Grandfather + siblings via muqasama. Any descendant here is unsupported (raise)."""
    if heirs.has_descendant():
        raise UnsupportedConfiguration(
            "Grandfather together with siblings AND a descendant is not implemented — "
            "this combination should be reviewed by an ustadz.",
            ruleset=config.key.value,
        )

    # Furud for the non-competing heirs only (spouse, mother, grandmother). Zero the
    # grandfather and the siblings so compute_furud does not assign them fixed shares;
    # muqasama distributes the residue between them instead.
    others = dict(present)
    for r in (
        Relation.PATERNAL_GRANDFATHER,
        Relation.FULL_BROTHER, Relation.FULL_SISTER,
        Relation.PATERNAL_BROTHER, Relation.PATERNAL_SISTER,
    ):
        others[r] = 0
    furud_awards, extra_blocked, notes = compute_furud(heirs, others, config)
    blocked.extend(extra_blocked)
    if furud_awards:
        steps.append(DerivationStep(
            step="furud", title="Bagian tetap (furud muqaddarah)",
            detail="; ".join(a.reason for a in furud_awards),
        ))

    furud_total = sum((a.share for a in furud_awards), Fraction(0))
    residue = Fraction(1) - furud_total
    gf_awards, gf_steps = jadd_resolve(present, residue, has_furud=furud_total > 0, config=config)
    steps.extend(gf_steps)

    awards = furud_awards + gf_awards
    return DeriveResult(
        awards=awards, blocked=blocked, steps=steps, notes=notes, present=present,
        pokok_masalah=_pokok(awards),
    )
