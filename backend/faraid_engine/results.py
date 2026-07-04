"""Structured result types.

CLAUDE.md: each rule returns a structured result with ``{heir, share, rule_applied,
source_id}`` — never just a number. These types carry the full derivation so the
frontend can render the step-by-step "why" (PRD §3, §5.2).

Shares are :class:`fractions.Fraction` — exact rationals, no floating point.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from fractions import Fraction

from .heirs import Relation, Ruleset, Mode


class ShareCategory(str, Enum):
    FURUD = "furud"            # fixed Qur'anic share (ashabul furud)
    ASABAH = "asabah"          # residuary
    RADD = "radd"              # surplus returned to fixed-share heirs
    DZAWIL_ARHAM = "dzawil_arham"
    HARTA_BERSAMA = "harta_bersama"  # spouse's community-property share (pre-faraid)


class AsabahType(str, Enum):
    """The three residuary types (PRD §5.2 step 5) — modeled distinctly."""

    BINAFSIHI = "bi_nafsihi"      # residuary in own right (e.g. son, father, brother)
    BIGHAIRIHI = "bi_ghairihi"    # made residuary by a male (e.g. daughter with son)
    MAAGHAIRIHI = "maa_ghairihi"  # residuary alongside another (e.g. sister with daughter)


@dataclass(frozen=True)
class HeirShare:
    """One heir group's outcome, fully attributed."""

    relation: Relation
    count: int
    share: Fraction              # combined share of the whole group (fraction of estate)
    per_head: Fraction           # share per individual in the group
    category: ShareCategory
    rule_applied: str            # short machine tag, e.g. "furud:daughter:2/3"
    reason: str                  # human-readable explanation (Bahasa Indonesia friendly)
    source_id: str               # MUST resolve in faraid_engine.sources
    asabah_type: AsabahType | None = None


@dataclass(frozen=True)
class HajbEntry:
    """A heir excluded by a closer heir (PRD §5.2 step 3).

    Rendered as an explicit "blocked because X" list — heirs are never silently dropped.
    ``full`` distinguishes hajb hirman (total exclusion) from a share reduction.
    """

    relation: Relation
    count: int
    blocked_by: Relation
    reason: str
    source_id: str
    full: bool = True


@dataclass(frozen=True)
class DerivationStep:
    """One entry in the ordered derivation log (PRD §5.2 pipeline)."""

    step: str        # "debts" | "harta_bersama" | "hajb" | "furud" | "asabah" | ...
    title: str
    detail: str
    source_id: str | None = None
    data: dict = field(default_factory=dict)  # optional structured payload for the UI


@dataclass(frozen=True)
class EstateBreakdown:
    """The netting from gross estate to the divisible remainder (PRD §5.2 steps 1–2)."""

    gross_value: Decimal
    funeral_costs: Decimal
    debts: Decimal
    wasiyya: Decimal
    harta_bersama_deducted: Decimal
    net_divisible: Decimal


@dataclass
class CalculationResult:
    """The complete, citable derivation returned by the engine."""

    ruleset: Ruleset
    mode: Mode
    shares: list[HeirShare] = field(default_factory=list)
    blocked: list[HajbEntry] = field(default_factory=list)
    steps: list[DerivationStep] = field(default_factory=list)
    estate: EstateBreakdown | None = None

    pokok_masalah: int = 1        # the base (common denominator) of the problem
    aul_applied: bool = False
    aul_base: int | None = None   # e.g. 6→7 records 7 here
    radd_applied: bool = False

    notes: list[str] = field(default_factory=list)  # caveats to surface (e.g. KHI 177)
    disclaimer: str = ""
    beta: bool = False            # true for Tier-2 madhabs (Beta badge)

    def total_share(self) -> Fraction:
        """Sum of all awarded shares (excluding harta bersama, which is pre-faraid)."""
        return sum(
            (s.share for s in self.shares if s.category != ShareCategory.HARTA_BERSAMA),
            Fraction(0),
        )

    def money_for(self, heir_share: HeirShare) -> Decimal | None:
        """Monetary value of a group's share against the net divisible estate."""
        if self.estate is None:
            return None
        return (
            Decimal(heir_share.share.numerator)
            / Decimal(heir_share.share.denominator)
            * self.estate.net_divisible
        )
