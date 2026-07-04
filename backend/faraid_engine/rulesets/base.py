"""Rule-set configuration.

KHI and classical Syafi'i are modeled as SEPARATE rule sets, not variants (PRD §4.1,
CLAUDE.md). A :class:`RuleSetConfig` captures every point on which they diverge, plus
the per-rule citation mapping (KHI rules cite pasal numbers; Syafi'i rules cite Qur'an/
hadith). Shared rule *logic* lives in :mod:`faraid_engine.rules`; the config is what
those functions read to behave correctly for the active madhab.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..heirs import Ruleset
from ..sources import get_source


@dataclass(frozen=True)
class RuleSetConfig:
    key: Ruleset
    name: str
    beta: bool

    # --- Divergence switches (PRD §4.1) -------------------------------------------
    supports_representation: bool           # KHI Pasal 185 pengganti; classical: no
    supports_harta_bersama: bool            # KHI civil-law concept; classical: no
    grandfather_blocks_siblings: bool       # KHI treats kakek like ayah; Syafi'i: al-jadd
                                            # wal-ikhwah muqasama (not implemented → raise)
    radd_includes_spouse_when_sole: bool    # KHI practice vs. classical baitul mal
    dzawil_arham_distributed: bool          # Hanafi/Hanbali/KHI-practice True; Syafi'i/Maliki
                                            # route residue to baitul mal instead

    # Maliki rejects radd entirely (baitul mal is treated as an heir); Hanafi, Hanbali,
    # KHI, and later-Syafi'i practice accept radd to non-spouse ashabul furud.
    applies_radd: bool = True

    # --- Per-rule citation mapping ------------------------------------------------
    # Keys are stable rule tags used across faraid_engine.rules; values are source_ids
    # that MUST resolve in faraid_engine.sources.
    sources: dict[str, str] = None  # type: ignore[assignment]

    def source_for(self, rule_key: str) -> str:
        """Resolve the citation for ``rule_key``; raises if unmapped or unregistered."""
        try:
            source_id = self.sources[rule_key]
        except KeyError as exc:
            raise KeyError(
                f"Ruleset {self.key.value!r} has no citation mapped for rule {rule_key!r}. "
                f"Every fired rule must be cited (PRD §5.3)."
            ) from exc
        get_source(source_id)  # validate it exists; raises UnknownSource otherwise
        return source_id
