"""faraid_engine — deterministic Islamic inheritance (faraid) rule engine.

Pure Python, ZERO Django dependency (CLAUDE.md). No AI/LLM in the calculation path
(PRD §7). Every rule fired is cited via :mod:`faraid_engine.sources`.
"""

__version__ = "0.1.0"

from .exceptions import (
    FaraidError,
    InvalidHeirInput,
    UnsupportedConfiguration,
    EngineInvariantError,
)
from .heirs import (
    CalculationInput,
    Estate,
    Heirs,
    Mode,
    Relation,
    Representative,
    Ruleset,
)
from .pipeline import calculate
from .results import CalculationResult, HeirShare, ShareCategory, AsabahType

__all__ = [
    "__version__",
    "calculate",
    "CalculationInput",
    "CalculationResult",
    "Heirs",
    "Estate",
    "Representative",
    "Relation",
    "Ruleset",
    "Mode",
    "HeirShare",
    "ShareCategory",
    "AsabahType",
    "FaraidError",
    "InvalidHeirInput",
    "UnsupportedConfiguration",
    "EngineInvariantError",
]
