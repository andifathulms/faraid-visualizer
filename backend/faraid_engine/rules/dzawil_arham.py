"""PRD §5.2 step 8: dzawil arham routing.

Reached only when NO ashabul furud and NO asabah exist at all. Routing depends on the
active madhab (PRD §4.1): Syafi'i/Maliki historically route to baitul mal; Hanafi/Hanbali
(and KHI practice) distribute to dzawil arham.

The v1 heir-input model (PRD §5.1) captures only ashabul furud and asabah relations, so
a "dzawil arham only" configuration would require heir types the engine does not yet
accept (e.g. maternal grandfather, daughter's children, sister's children). Rather than
guess a distribution, this raises :class:`UnsupportedConfiguration` — the CLAUDE.md
guardrail: an unhandled edge case surfaces as an explicit error, never a wrong number.
"""

from __future__ import annotations

from ..exceptions import UnsupportedConfiguration
from ..rulesets.base import RuleSetConfig


def resolve_dzawil_arham(config: RuleSetConfig) -> None:
    raise UnsupportedConfiguration(
        "Only dzawil arham (distant kindred) would inherit here, but dzawil arham heir "
        "capture is not implemented in v1 (PRD §5.1 scope). This configuration cannot be "
        "resolved without inventing a distribution — please consult an ustadz/PPAIW. "
        f"(routing basis: {config.source_for('dzawil_arham')})",
        ruleset=config.key.value,
    )
