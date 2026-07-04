"""DRF serializers — server-side validation of calculation input (PRD step 6).

Never trust client-side-only validation for something feeding a legal calculation
(CLAUDE.md). This layer validates shape/ranges, then hands a typed
:class:`faraid_engine.CalculationInput` to the engine, which performs the deeper
fiqh-level validation and raises on unsupported configurations.
"""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from faraid_engine import (
    CalculationInput,
    Estate,
    Heirs,
    Mode,
    Relation,
    Representative,
    Ruleset,
)


class RepresentativeSerializer(serializers.Serializer):
    replacing = serializers.ChoiceField(choices=[Relation.SON.value, Relation.DAUGHTER.value])
    sons = serializers.IntegerField(min_value=0, default=0)
    daughters = serializers.IntegerField(min_value=0, default=0)


class HeirsSerializer(serializers.Serializer):
    husband = serializers.BooleanField(default=False)
    wives = serializers.IntegerField(min_value=0, max_value=4, default=0)
    sons = serializers.IntegerField(min_value=0, default=0)
    daughters = serializers.IntegerField(min_value=0, default=0)
    father = serializers.BooleanField(default=False)
    mother = serializers.BooleanField(default=False)
    paternal_grandfather = serializers.BooleanField(default=False)
    paternal_grandmother = serializers.BooleanField(default=False)
    maternal_grandmother = serializers.BooleanField(default=False)
    grandsons_via_son = serializers.IntegerField(min_value=0, default=0)
    granddaughters_via_son = serializers.IntegerField(min_value=0, default=0)
    full_brothers = serializers.IntegerField(min_value=0, default=0)
    full_sisters = serializers.IntegerField(min_value=0, default=0)
    paternal_brothers = serializers.IntegerField(min_value=0, default=0)
    paternal_sisters = serializers.IntegerField(min_value=0, default=0)
    maternal_siblings = serializers.IntegerField(min_value=0, default=0)
    representatives = RepresentativeSerializer(many=True, default=list)

    def to_heirs(self) -> Heirs:
        d = dict(self.validated_data)
        reps = tuple(
            Representative(
                replacing=Relation(r["replacing"]),
                sons=r.get("sons", 0),
                daughters=r.get("daughters", 0),
            )
            for r in d.pop("representatives", [])
        )
        return Heirs(representatives=reps, **d)


class EstateSerializer(serializers.Serializer):
    gross_value = serializers.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    funeral_costs = serializers.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    debts = serializers.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    wasiyya = serializers.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    joint_assets = serializers.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))

    def to_estate(self) -> Estate:
        return Estate(**self.validated_data)


class CalculationInputSerializer(serializers.Serializer):
    heirs = HeirsSerializer()
    ruleset = serializers.ChoiceField(choices=[r.value for r in Ruleset], default=Ruleset.KHI.value)
    mode = serializers.ChoiceField(choices=[m.value for m in Mode], default=Mode.PERSONAL.value)
    estate = EstateSerializer(required=False)
    apply_harta_bersama = serializers.BooleanField(default=False)

    def to_calculation_input(self, *, mode_override: str | None = None) -> CalculationInput:
        data = self.validated_data
        heirs_ser = HeirsSerializer(data=data["heirs"])
        heirs_ser.is_valid(raise_exception=True)

        estate = Estate()
        if data.get("estate"):
            estate_ser = EstateSerializer(data=data["estate"])
            estate_ser.is_valid(raise_exception=True)
            estate = estate_ser.to_estate()

        return CalculationInput(
            heirs=heirs_ser.to_heirs(),
            ruleset=Ruleset(data["ruleset"]),
            mode=Mode(mode_override or data["mode"]),
            estate=estate,
            apply_harta_bersama=data["apply_harta_bersama"],
        )
