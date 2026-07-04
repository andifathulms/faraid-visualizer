"""Heir domain model & calculation input (PRD §5.1).

Pure data structures — no rule logic lives here. The engine consumes a
:class:`CalculationInput`; each ruleset interprets it.

Monetary amounts use :class:`decimal.Decimal`; shares (computed downstream) use
:class:`fractions.Fraction` for exact rational arithmetic. Faraid is a ledger, not a
place for floating-point error (CLAUDE.md).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from .exceptions import InvalidHeirInput


class Relation(str, Enum):
    """Every heir slot the engine can reason about.

    Uterine (maternal) siblings are sex-neutral for share purposes (they split equally),
    so a single slot suffices. Grandfather/grandmother slots are limited to those who are
    ashabul furud or asabah; the maternal grandfather is dzawil arham and handled in that
    step, not here.
    """

    HUSBAND = "husband"
    WIFE = "wife"
    SON = "son"
    DAUGHTER = "daughter"
    FATHER = "father"
    MOTHER = "mother"
    PATERNAL_GRANDFATHER = "paternal_grandfather"  # father's father (al-jadd)
    PATERNAL_GRANDMOTHER = "paternal_grandmother"  # father's mother
    MATERNAL_GRANDMOTHER = "maternal_grandmother"  # mother's mother
    GRANDSON_VIA_SON = "grandson_via_son"          # son's son (ibn al-ibn)
    GRANDDAUGHTER_VIA_SON = "granddaughter_via_son"  # son's daughter (bint al-ibn)
    FULL_BROTHER = "full_brother"
    FULL_SISTER = "full_sister"
    PATERNAL_BROTHER = "paternal_brother"
    PATERNAL_SISTER = "paternal_sister"
    MATERNAL_SIBLING = "maternal_sibling"  # uterine — sex-neutral

    @property
    def label_id(self) -> str:
        """Bahasa Indonesia label key (UI resolves to display text)."""
        return {
            Relation.HUSBAND: "suami",
            Relation.WIFE: "istri",
            Relation.SON: "anak_laki",
            Relation.DAUGHTER: "anak_perempuan",
            Relation.FATHER: "ayah",
            Relation.MOTHER: "ibu",
            Relation.PATERNAL_GRANDFATHER: "kakek",
            Relation.PATERNAL_GRANDMOTHER: "nenek_ayah",
            Relation.MATERNAL_GRANDMOTHER: "nenek_ibu",
            Relation.GRANDSON_VIA_SON: "cucu_laki",
            Relation.GRANDDAUGHTER_VIA_SON: "cucu_perempuan",
            Relation.FULL_BROTHER: "saudara_laki_kandung",
            Relation.FULL_SISTER: "saudari_kandung",
            Relation.PATERNAL_BROTHER: "saudara_laki_seayah",
            Relation.PATERNAL_SISTER: "saudari_seayah",
            Relation.MATERNAL_SIBLING: "saudara_seibu",
        }[self]


@dataclass(frozen=True)
class Representative:
    """Descendants of a predeceased heir who may inherit by representation.

    Only meaningful under KHI (Pasal 185 — ahli waris pengganti). Classical Syafi'i has
    no representation concept (PRD §4.1); a ruleset that does not support this MUST raise
    :class:`~faraid_engine.exceptions.UnsupportedConfiguration` rather than silently
    ignore it, so the divergence is never hidden from the user.

    ``replacing`` is the heir who predeceased (e.g. :attr:`Relation.SON`). ``sons`` /
    ``daughters`` are that heir's children who step into the vacated position.
    """

    replacing: Relation
    sons: int = 0
    daughters: int = 0


@dataclass(frozen=True)
class Heirs:
    """Living heirs of the deceased, as counts (PRD §5.1 — names not needed).

    A person's estate has either a husband OR wives, never both. Spouse plurality (up to
    4 wives) is realistic in Indonesia and shares a single fixed portion split equally.
    """

    husband: bool = False
    wives: int = 0
    sons: int = 0
    daughters: int = 0
    father: bool = False
    mother: bool = False
    paternal_grandfather: bool = False
    paternal_grandmother: bool = False
    maternal_grandmother: bool = False
    grandsons_via_son: int = 0
    granddaughters_via_son: int = 0
    full_brothers: int = 0
    full_sisters: int = 0
    paternal_brothers: int = 0
    paternal_sisters: int = 0
    maternal_siblings: int = 0
    representatives: tuple[Representative, ...] = ()

    def validate(self) -> None:
        counts = {
            "wives": self.wives,
            "sons": self.sons,
            "daughters": self.daughters,
            "grandsons_via_son": self.grandsons_via_son,
            "granddaughters_via_son": self.granddaughters_via_son,
            "full_brothers": self.full_brothers,
            "full_sisters": self.full_sisters,
            "paternal_brothers": self.paternal_brothers,
            "paternal_sisters": self.paternal_sisters,
            "maternal_siblings": self.maternal_siblings,
        }
        for name, n in counts.items():
            if n < 0:
                raise InvalidHeirInput(f"{name} count cannot be negative (got {n}).")
        if self.husband and self.wives:
            raise InvalidHeirInput(
                "An estate cannot have both a husband and wives — a person is either a "
                "wife's estate (husband inherits) or a husband's estate (wives inherit)."
            )
        if self.wives > 4:
            raise InvalidHeirInput("At most 4 wives may inherit (max plural marriage).")
        if not self._has_any_heir():
            raise InvalidHeirInput("No heirs provided.")

    def _has_any_heir(self) -> bool:
        return any(
            [
                self.husband,
                self.wives,
                self.sons,
                self.daughters,
                self.father,
                self.mother,
                self.paternal_grandfather,
                self.paternal_grandmother,
                self.maternal_grandmother,
                self.grandsons_via_son,
                self.granddaughters_via_son,
                self.full_brothers,
                self.full_sisters,
                self.paternal_brothers,
                self.paternal_sisters,
                self.maternal_siblings,
                self.representatives,
            ]
        )

    def count_of(self, relation: Relation) -> int:
        """Number of individuals occupying ``relation`` (0 or 1 for singleton slots)."""
        mapping = {
            Relation.HUSBAND: 1 if self.husband else 0,
            Relation.WIFE: self.wives,
            Relation.SON: self.sons,
            Relation.DAUGHTER: self.daughters,
            Relation.FATHER: 1 if self.father else 0,
            Relation.MOTHER: 1 if self.mother else 0,
            Relation.PATERNAL_GRANDFATHER: 1 if self.paternal_grandfather else 0,
            Relation.PATERNAL_GRANDMOTHER: 1 if self.paternal_grandmother else 0,
            Relation.MATERNAL_GRANDMOTHER: 1 if self.maternal_grandmother else 0,
            Relation.GRANDSON_VIA_SON: self.grandsons_via_son,
            Relation.GRANDDAUGHTER_VIA_SON: self.granddaughters_via_son,
            Relation.FULL_BROTHER: self.full_brothers,
            Relation.FULL_SISTER: self.full_sisters,
            Relation.PATERNAL_BROTHER: self.paternal_brothers,
            Relation.PATERNAL_SISTER: self.paternal_sisters,
            Relation.MATERNAL_SIBLING: self.maternal_siblings,
        }
        return mapping[relation]

    # --- Derived predicates used across rules -----------------------------------
    def has_descendant(self) -> bool:
        """Any child or agnatic grandchild (affects spouse/parent/sibling shares)."""
        return bool(
            self.sons
            or self.daughters
            or self.grandsons_via_son
            or self.granddaughters_via_son
        )

    def has_male_descendant(self) -> bool:
        """A son or son's son — the strongest blocker (hajb) in the pipeline."""
        return bool(self.sons or self.grandsons_via_son)

    def sibling_count(self) -> int:
        """Total siblings of every kind — triggers mother's reduction to 1/6 (hajb naqis)."""
        return (
            self.full_brothers
            + self.full_sisters
            + self.paternal_brothers
            + self.paternal_sisters
            + self.maternal_siblings
        )


@dataclass(frozen=True)
class Estate:
    """The estate to be divided, with the PRD §5.2 step-1/2 deductions.

    ``joint_assets`` is only meaningful for the KHI harta bersama toggle (PRD §4.1).
    """

    gross_value: Decimal = Decimal("0")
    funeral_costs: Decimal = Decimal("0")
    debts: Decimal = Decimal("0")
    wasiyya: Decimal = Decimal("0")  # bequest — capped at 1/3 of post-debt estate
    joint_assets: Decimal = Decimal("0")

    def validate(self) -> None:
        for name in ("gross_value", "funeral_costs", "debts", "wasiyya", "joint_assets"):
            v = getattr(self, name)
            if v < 0:
                raise InvalidHeirInput(f"Estate.{name} cannot be negative (got {v}).")


class Ruleset(str, Enum):
    KHI = "khi"
    SYAFII = "syafii"
    HANAFI = "hanafi"  # Tier 2 — Beta
    MALIKI = "maliki"  # Tier 2 — Beta
    HANBALI = "hanbali"  # Tier 2 — Beta

    @property
    def is_beta(self) -> bool:
        return self in {Ruleset.HANAFI, Ruleset.MALIKI, Ruleset.HANBALI}


class Mode(str, Enum):
    PERSONAL = "personal"
    PROFESSIONAL = "professional"


@dataclass(frozen=True)
class CalculationInput:
    """Everything the engine needs to produce a derivation."""

    heirs: Heirs
    ruleset: Ruleset = Ruleset.KHI
    mode: Mode = Mode.PERSONAL
    estate: Estate = field(default_factory=Estate)
    apply_harta_bersama: bool = False

    def validate(self) -> None:
        self.heirs.validate()
        self.estate.validate()
        if self.apply_harta_bersama and self.ruleset != Ruleset.KHI:
            raise InvalidHeirInput(
                "Harta bersama (marital community property) is a KHI-only step and has no "
                "classical-fiqh equivalent (PRD §4.1); it cannot be applied under "
                f"ruleset {self.ruleset.value!r}."
            )
        if self.heirs.representatives and self.ruleset != Ruleset.KHI:
            raise InvalidHeirInput(
                "Ahli waris pengganti (representation) is a KHI Pasal 185 concept with no "
                "classical Syafi'i equivalent (PRD §4.1); representatives cannot be used "
                f"under ruleset {self.ruleset.value!r}."
            )
