"""Input validation — pure Python, ZERO Django/DRF dependency.

This is the SINGLE validator for calculation input. It previously lived in
``api/serializers.py`` as DRF serializers; it was lifted out so the exact same
validation runs in three places without drift:

* the DRF endpoints (server-side validation, CLAUDE.md build step 6),
* the in-browser Pyodide runtime (the static GitHub Pages build has no server),
* unit tests, with no Django settings required.

Two failure kinds are kept deliberately distinct, because they mean different things:

* :class:`InvalidInput` — the *shape* is wrong (unknown ruleset, negative count, five
  wives). A client bug. Maps to HTTP 400.
* :class:`faraid_engine.InvalidHeirInput` / ``UnsupportedConfiguration`` — the shape is
  fine but the *fiqh* configuration is impossible or unhandled. Maps to HTTP 422.

Validation here is shallow on purpose: it guards types and ranges, then hands a typed
:class:`~faraid_engine.CalculationInput` to the engine, which owns the deeper fiqh-level
validation and raises explicitly rather than guessing (CLAUDE.md guardrail).
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal, InvalidOperation

from faraid_engine import (
    CalculationInput,
    Estate,
    Heirs,
    Mode,
    Relation,
    Representative,
    Ruleset,
)

LANGS = ("id", "en")

# Heir fields, split by type. Mirrors faraid_engine.Heirs' constructor.
_BOOL_HEIRS = (
    "husband",
    "father",
    "mother",
    "paternal_grandfather",
    "paternal_grandmother",
    "maternal_grandmother",
)
_COUNT_HEIRS = (
    "sons",
    "daughters",
    "grandsons_via_son",
    "granddaughters_via_son",
    "full_brothers",
    "full_sisters",
    "paternal_brothers",
    "paternal_sisters",
    "maternal_siblings",
)
_MONEY_FIELDS = ("gross_value", "funeral_costs", "debts", "wasiyya", "joint_assets")

# A marriage is capped at four wives (Qur'an 4:3); the engine assumes at most four
# spouse-shares when splitting the 1/8 or 1/4.
MAX_WIVES = 4

# Guard against absurd inputs that would make the LCM arithmetic explode. No real estate
# case approaches this; it exists so a hostile or fat-fingered payload fails loudly.
MAX_COUNT = 50

# Matches the old DRF DecimalField(max_digits=20, decimal_places=2).
_MAX_MONEY_DIGITS = 20


class InvalidInput(Exception):
    """Malformed request payload. Carries per-field errors, DRF-style."""

    def __init__(self, errors: dict[str, object]) -> None:
        self.errors = errors
        super().__init__(str(errors))


def _as_bool(value: object, field: str) -> bool:
    if isinstance(value, bool):
        return value
    if value in (1, 0):
        return bool(value)
    if isinstance(value, str) and value.lower() in ("true", "false", "1", "0"):
        return value.lower() in ("true", "1")
    raise InvalidInput({field: "Must be a boolean."})


def _as_count(value: object, field: str, *, maximum: int = MAX_COUNT) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise InvalidInput({field: "Must be an integer."})
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise InvalidInput({field: "Must be an integer."}) from None
    if n < 0:
        raise InvalidInput({field: "Must be 0 or greater."})
    if n > maximum:
        raise InvalidInput({field: f"Must be {maximum} or fewer."})
    return n


def _as_money(value: object, field: str) -> Decimal:
    if isinstance(value, bool):
        raise InvalidInput({field: "Must be a decimal number."})
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise InvalidInput({field: "Must be a decimal number."}) from None
    if not d.is_finite():
        raise InvalidInput({field: "Must be a finite number."})
    if d < 0:
        raise InvalidInput({field: "Must be 0 or greater."})
    if len(d.as_tuple().digits) > _MAX_MONEY_DIGITS:
        raise InvalidInput({field: f"Must have at most {_MAX_MONEY_DIGITS} digits."})
    return d.quantize(Decimal("0.01"))


def _as_choice(value: object, field: str, choices: tuple[str, ...]) -> str:
    if value not in choices:
        raise InvalidInput({field: f'"{value}" is not one of {list(choices)}.'})
    return str(value)


def _validate_heirs(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise InvalidInput({"heirs": "Must be an object."})

    data: dict[str, object] = {}
    for field in _BOOL_HEIRS:
        data[field] = _as_bool(raw.get(field, False), field)
    for field in _COUNT_HEIRS:
        data[field] = _as_count(raw.get(field, 0), field)
    data["wives"] = _as_count(raw.get("wives", 0), "wives", maximum=MAX_WIVES)

    reps_raw = raw.get("representatives") or []
    if not isinstance(reps_raw, list):
        raise InvalidInput({"representatives": "Must be a list."})
    reps = []
    for i, rep in enumerate(reps_raw):
        if not isinstance(rep, dict):
            raise InvalidInput({f"representatives[{i}]": "Must be an object."})
        reps.append(
            {
                "replacing": _as_choice(
                    rep.get("replacing"),
                    f"representatives[{i}].replacing",
                    (Relation.SON.value, Relation.DAUGHTER.value),
                ),
                "sons": _as_count(rep.get("sons", 0), f"representatives[{i}].sons"),
                "daughters": _as_count(rep.get("daughters", 0), f"representatives[{i}].daughters"),
            }
        )
    data["representatives"] = reps
    return data


def _validate_estate(raw: object) -> dict:
    if raw is None:
        return {field: Decimal("0") for field in _MONEY_FIELDS}
    if not isinstance(raw, dict):
        raise InvalidInput({"estate": "Must be an object."})
    return {field: _as_money(raw.get(field, 0), field) for field in _MONEY_FIELDS}


def validate_payload(payload: object) -> dict:
    """Validate a raw request body and return normalized, typed data.

    Unknown keys are ignored (DRF's default behaviour, preserved so existing clients
    keep working). Raises :class:`InvalidInput` on the first shape/range violation.
    """
    if not isinstance(payload, dict):
        raise InvalidInput({"non_field_errors": "Request body must be an object."})

    return {
        "heirs": _validate_heirs(payload.get("heirs")),
        "estate": _validate_estate(payload.get("estate")),
        "ruleset": _as_choice(
            payload.get("ruleset", Ruleset.KHI.value),
            "ruleset",
            tuple(r.value for r in Ruleset),
        ),
        "mode": _as_choice(
            payload.get("mode", Mode.PERSONAL.value), "mode", tuple(m.value for m in Mode)
        ),
        "apply_harta_bersama": _as_bool(
            payload.get("apply_harta_bersama", False), "apply_harta_bersama"
        ),
        "lang": _as_choice(payload.get("lang", "id"), "lang", LANGS),
    }


def build_input(
    data: dict, *, mode_override: str | None = None, ruleset_override: str | None = None
) -> CalculationInput:
    """Turn validated data into a typed :class:`~faraid_engine.CalculationInput`."""
    heirs_data = dict(data["heirs"])
    reps = tuple(
        Representative(
            replacing=Relation(r["replacing"]), sons=r["sons"], daughters=r["daughters"]
        )
        for r in heirs_data.pop("representatives", [])
    )
    heirs = Heirs(representatives=reps, **heirs_data)

    ruleset = Ruleset(ruleset_override or data["ruleset"])
    # Harta bersama and ahli waris pengganti are KHI-only constructs (PRD §4.1). Drop them
    # for classical rule sets so a KHI-vs-Syafi'i comparison doesn't fail validation on the
    # classical side — the divergence is the point of the comparison.
    apply_hb = data["apply_harta_bersama"] and ruleset == Ruleset.KHI
    if ruleset != Ruleset.KHI and heirs.representatives:
        heirs = replace(heirs, representatives=())

    return CalculationInput(
        heirs=heirs,
        ruleset=ruleset,
        mode=Mode(mode_override or data["mode"]),
        estate=Estate(**data["estate"]),
        apply_harta_bersama=apply_hb,
    )
