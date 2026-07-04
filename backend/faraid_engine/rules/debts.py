"""PRD §5.2 steps 1–2: net the estate before faraid.

Sequence per KHI Pasal 175: funeral costs → debts → wasiat (capped at 1/3) → faraid.
Harta bersama (KHI-only, optional) separates the surviving spouse's marital
community-property share BEFORE faraid applies to the remainder (PRD §4.1).

These operate purely on monetary values (:class:`decimal.Decimal`); they do not touch
fractional shares. Faraid fractions are computed against ``net_divisible``.
"""

from __future__ import annotations

from decimal import Decimal

from ..heirs import Estate
from ..results import DerivationStep, EstateBreakdown


def deduct_debts(
    estate: Estate,
    debts_source: str,
    *,
    apply_harta_bersama: bool = False,
    harta_bersama_source: str | None = None,
) -> tuple[EstateBreakdown, list[DerivationStep]]:
    """Return the estate breakdown and derivation steps for netting the estate.

    Wasiat above 1/3 of the post-funeral/post-debt estate is capped (KHI Pasal 175 /
    consensus); the cap is recorded as a step so the user sees it.
    """
    steps: list[DerivationStep] = []

    after_funeral = estate.gross_value - estate.funeral_costs
    after_debts = after_funeral - estate.debts

    # Wasiat capped at 1/3 of the estate remaining after funeral costs and debts.
    wasiyya_cap = after_debts / Decimal(3) if after_debts > 0 else Decimal(0)
    wasiyya = estate.wasiyya
    capped = False
    if wasiyya > wasiyya_cap:
        wasiyya = wasiyya_cap
        capped = True
    after_wasiyya = after_debts - wasiyya

    detail = (
        f"Kotor {estate.gross_value} − biaya pemakaman {estate.funeral_costs} − utang "
        f"{estate.debts} − wasiat {wasiyya} = {after_wasiyya}."
    )
    if capped:
        detail += (
            f" Wasiat dibatasi maksimal 1/3 ({wasiyya_cap}) dari sisa setelah utang; "
            f"kelebihan tidak dilaksanakan tanpa persetujuan ahli waris."
        )
    steps.append(
        DerivationStep(
            step="debts",
            title="Pelunasan kewajiban atas harta peninggalan",
            detail=detail,
            source_id=debts_source,
            data={
                "gross": str(estate.gross_value),
                "funeral": str(estate.funeral_costs),
                "debts": str(estate.debts),
                "wasiyya": str(wasiyya),
                "wasiyya_capped": capped,
                "after_wasiyya": str(after_wasiyya),
            },
        )
    )

    harta_bersama_deducted = Decimal(0)
    if apply_harta_bersama:
        # Surviving spouse keeps 1/2 of joint marital assets, separated before faraid.
        harta_bersama_deducted = estate.joint_assets / Decimal(2)
        steps.append(
            DerivationStep(
                step="harta_bersama",
                title="Pemisahan harta bersama (bagian pasangan yang masih hidup)",
                detail=(
                    f"Setengah dari harta bersama {estate.joint_assets} = "
                    f"{harta_bersama_deducted} dipisahkan lebih dulu sebagai hak pasangan "
                    f"yang masih hidup; sisanya menjadi harta warisan."
                ),
                source_id=harta_bersama_source,
                data={
                    "joint_assets": str(estate.joint_assets),
                    "spouse_share": str(harta_bersama_deducted),
                },
            )
        )

    net_divisible = after_wasiyya - harta_bersama_deducted
    if net_divisible < 0:
        net_divisible = Decimal(0)

    breakdown = EstateBreakdown(
        gross_value=estate.gross_value,
        funeral_costs=estate.funeral_costs,
        debts=estate.debts,
        wasiyya=wasiyya,
        harta_bersama_deducted=harta_bersama_deducted,
        net_divisible=net_divisible,
    )
    return breakdown, steps
