"""Rule-set registry."""

from __future__ import annotations

from ..exceptions import UnsupportedConfiguration
from ..heirs import Ruleset
from .base import RuleSetConfig
from .beta import HANAFI, HANBALI, MALIKI
from .khi import KHI
from .syafii import SYAFII

_REGISTRY: dict[Ruleset, RuleSetConfig] = {
    Ruleset.KHI: KHI,
    Ruleset.SYAFII: SYAFII,
    Ruleset.HANAFI: HANAFI,   # Beta
    Ruleset.MALIKI: MALIKI,   # Beta
    Ruleset.HANBALI: HANBALI,  # Beta
}


def get_config(ruleset: Ruleset) -> RuleSetConfig:
    """Return the config for ``ruleset``.

    Tier-2 madhabs are registered but flagged ``beta`` — the pipeline surfaces the Beta
    caveat and the UI shows the badge. An entirely unknown ruleset still raises
    :class:`UnsupportedConfiguration` rather than falling through to a default.
    """
    try:
        return _REGISTRY[ruleset]
    except KeyError as exc:
        raise UnsupportedConfiguration(
            f"Rule set {ruleset.value!r} is not implemented.", ruleset=ruleset.value
        ) from exc


__all__ = ["RuleSetConfig", "KHI", "SYAFII", "HANAFI", "MALIKI", "HANBALI", "get_config"]
