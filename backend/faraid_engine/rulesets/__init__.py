"""Rule-set registry."""

from __future__ import annotations

from ..exceptions import UnsupportedConfiguration
from ..heirs import Ruleset
from .base import RuleSetConfig
from .khi import KHI
from .syafii import SYAFII

_REGISTRY: dict[Ruleset, RuleSetConfig] = {
    Ruleset.KHI: KHI,
    Ruleset.SYAFII: SYAFII,
}


def get_config(ruleset: Ruleset) -> RuleSetConfig:
    """Return the config for ``ruleset``.

    Tier-2 madhabs (Hanafi/Maliki/Hanbali) are not yet registered; requesting one raises
    :class:`UnsupportedConfiguration` rather than silently reusing Syafi'i logic under a
    different label — the one failure mode PRD §4 explicitly designs against.
    """
    try:
        return _REGISTRY[ruleset]
    except KeyError as exc:
        raise UnsupportedConfiguration(
            f"Rule set {ruleset.value!r} is not implemented yet. Tier-2 madhabs "
            f"(Hanafi/Maliki/Hanbali) ship later, behind a Beta badge, with their own "
            f"validation pass (PRD §4).",
            ruleset=ruleset.value,
        ) from exc


__all__ = ["RuleSetConfig", "KHI", "SYAFII", "get_config"]
