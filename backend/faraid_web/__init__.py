"""faraid_web — presentation & application layer around :mod:`faraid_engine`.

Pure Python with ZERO Django dependency, exactly like the engine it wraps. It holds
everything that turns an engine result into something a human reads — validation,
bilingual labels, derivation prose, JSON serialization, PDF layout — without knowing
whether it is running inside a Django process or inside a browser tab via Pyodide.

That is the point: the static GitHub Pages build ships this same package to the browser,
so the deployed calculator runs byte-identical validation, wording, and citations to the
Django API. Anything Django-specific (views, DRF, ORM) lives in ``api/`` instead.
"""

__version__ = "0.1.0"

from .service import (
    calculate_payload,
    compare_payload,
    pdf_payload,
    sources_payload,
)
from .validate import InvalidInput, build_input, validate_payload

__all__ = [
    "__version__",
    "calculate_payload",
    "compare_payload",
    "pdf_payload",
    "sources_payload",
    "InvalidInput",
    "validate_payload",
    "build_input",
]
