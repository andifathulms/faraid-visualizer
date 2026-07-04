"""Engine exceptions.

CLAUDE.md guardrail: the engine must NEVER fall through to a default/guessed rule when
a heir configuration doesn't match a known pattern. It raises one of these instead, so
an unsupported case surfaces to the user as an explicit error ("this configuration isn't
supported yet"), never a silently wrong number.
"""

from __future__ import annotations


class FaraidError(Exception):
    """Base class for all engine errors."""


class InvalidHeirInput(FaraidError):
    """The heir/estate input is malformed or internally contradictory.

    Examples: negative counts, a husband AND wives on the same estate, wasiat above the
    1/3 cap, harta bersama requested on a classical (non-KHI) ruleset.
    """


class UnsupportedConfiguration(FaraidError):
    """A heir configuration the active ruleset does not (yet) know how to resolve.

    Raised rather than guessing. The ``reason`` explains what is unsupported so the UI
    can show a precise message.
    """

    def __init__(self, reason: str, ruleset: str | None = None):
        self.reason = reason
        self.ruleset = ruleset
        prefix = f"[{ruleset}] " if ruleset else ""
        super().__init__(f"{prefix}Unsupported heir configuration: {reason}")


class EngineInvariantError(FaraidError):
    """An internal invariant was violated — indicates an engine bug, not bad input.

    Example: an 'aul base outside the mathematically valid set (PRD §5.2 step 6), or
    shares that sum to more than 1 after 'aul was supposed to normalize them.
    """
