"""Professional-mode PDF export (PRD §7).

Produces the full derivation + citation trail — the artifact a notaris/PPAIW would attach
to a case file. Built with reportlab (no browser needed). Renders from the same serialized
payload the API returns, so the PDF and the on-screen derivation never diverge.

The disclaimer is always rendered (CLAUDE.md: disclaimer strings are a product
requirement, not boilerplate).
"""

from __future__ import annotations

import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .labels import RELATION_LABELS, RULESET_LABELS

ACCENT = colors.HexColor("#0d7a5f")
MUTED = colors.HexColor("#6b6b63")
BLOCKED = colors.HexColor("#b23b3b")


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("FTitle", parent=ss["Title"], fontSize=18, textColor=ACCENT, spaceAfter=2))
    ss.add(ParagraphStyle("FSub", parent=ss["Normal"], fontSize=9, textColor=MUTED, spaceAfter=10))
    ss.add(ParagraphStyle("FH2", parent=ss["Heading2"], fontSize=12, textColor=colors.black, spaceBefore=12, spaceAfter=4))
    ss.add(ParagraphStyle("FBody", parent=ss["Normal"], fontSize=9.5, leading=13, alignment=TA_LEFT))
    ss.add(ParagraphStyle("FSmall", parent=ss["Normal"], fontSize=8, textColor=MUTED, leading=11))
    ss.add(ParagraphStyle("FDisc", parent=ss["Normal"], fontSize=8.5, textColor=colors.HexColor("#7a5b12"), leading=12))
    return ss


def _rel_label(label_id: str) -> str:
    return RELATION_LABELS.get(label_id, label_id)


def build_pdf(payload: dict, heirs_input: dict | None = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm, title="Perhitungan Faraid",
    )
    ss = _styles()
    flow = []

    flow.append(Paragraph("Perhitungan Waris (Faraid)", ss["FTitle"]))
    flow.append(Paragraph(
        f"Dasar hukum: <b>{RULESET_LABELS.get(payload['ruleset'], payload['ruleset'])}</b>"
        f" &nbsp;·&nbsp; Mode Profesional"
        f" &nbsp;·&nbsp; Pokok masalah {payload['pokok_masalah']}"
        + (f" &nbsp;·&nbsp; 'aul → {payload['aul_base']}" if payload["aul_applied"] else "")
        + (" &nbsp;·&nbsp; radd" if payload["radd_applied"] else ""),
        ss["FSub"],
    ))
    if payload.get("beta"):
        flow.append(Paragraph("<b>BETA</b> — rule set ini masih dalam validasi ilmiah.", ss["FSmall"]))
    flow.append(HRFlowable(width="100%", color=colors.HexColor("#e3e3df")))

    # Heirs entered
    if heirs_input:
        entered = _describe_heirs(heirs_input)
        if entered:
            flow.append(Paragraph("Ahli waris yang dimasukkan", ss["FH2"]))
            flow.append(Paragraph(", ".join(entered), ss["FBody"]))

    # Estate breakdown
    e = payload.get("estate")
    if e and (e["net_divisible"] != e["gross_value"] or float(e["harta_bersama_deducted"]) > 0):
        flow.append(Paragraph("Harta yang dibagi", ss["FH2"]))
        flow.append(Paragraph(
            f"Kotor {e['gross_value']} − pemakaman {e['funeral_costs']} − utang {e['debts']} "
            f"− wasiat {e['wasiyya']}"
            + (f" − harta bersama {e['harta_bersama_deducted']}" if float(e["harta_bersama_deducted"]) > 0 else "")
            + f" = <b>{e['net_divisible']}</b>",
            ss["FBody"],
        ))

    # Shares table
    flow.append(Paragraph("Pembagian", ss["FH2"]))
    data = [["Ahli waris", "Bagian", "Per orang", "Kategori", "Jumlah"]]
    for s in payload["shares"]:
        data.append([
            _rel_label(s["label_id"]) + (f" ×{s['count']}" if s["count"] > 1 else ""),
            "—" if s["category"] == "harta_bersama" else s["share"]["text"],
            s["per_head"]["text"] if s["count"] > 1 and s["category"] != "harta_bersama" else "—",
            s["category"],
            s["amount"] or "—",
        ])
    table = Table(data, colWidths=[58 * mm, 22 * mm, 22 * mm, 30 * mm, 30 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f2ee")),
        ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e3e3df")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(table)

    # Reasoning per share (with citations)
    flow.append(Paragraph("Alasan &amp; dasar tiap bagian", ss["FH2"]))
    for s in payload["shares"]:
        cite = payload["sources"].get(s["source_id"])
        ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
        flow.append(Paragraph(f"<b>{_rel_label(s['label_id'])}:</b> {s['reason']}{ref}", ss["FSmall"]))
        flow.append(Spacer(1, 2))

    # Hajb
    if payload["blocked"]:
        flow.append(Paragraph("Terhalang (hajb)", ss["FH2"]))
        for b in payload["blocked"]:
            cite = payload["sources"].get(b["source_id"])
            ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
            flow.append(Paragraph(
                f"<b>{_rel_label(b['label_id'])}</b> terhalang oleh {_rel_label(b['blocked_by_label'])} "
                f"— {b['reason']}{ref}", ss["FSmall"],
            ))

    # Derivation steps
    flow.append(Paragraph("Langkah penurunan", ss["FH2"]))
    for i, st in enumerate(payload["steps"], 1):
        cite = payload["sources"].get(st["source_id"]) if st["source_id"] else None
        ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
        flow.append(Paragraph(f"{i}. <b>{st['title']}.</b> {st['detail']}{ref}", ss["FSmall"]))
        flow.append(Spacer(1, 2))

    # Notes
    if payload["notes"]:
        flow.append(Paragraph("Catatan", ss["FH2"]))
        for n in payload["notes"]:
            flow.append(Paragraph(f"• {n}", ss["FSmall"]))
            flow.append(Spacer(1, 2))

    # Citation list
    flow.append(Paragraph("Daftar rujukan", ss["FH2"]))
    for sid, src in sorted(payload["sources"].items()):
        flow.append(Paragraph(
            f"<b>[{src['pointer']}]</b> {src['reference']}" + (f" — {src['note']}" if src["note"] else ""),
            ss["FSmall"],
        ))
        flow.append(Spacer(1, 2))

    # Disclaimer (always)
    flow.append(Spacer(1, 8))
    flow.append(HRFlowable(width="100%", color=colors.HexColor("#e8c982")))
    flow.append(Spacer(1, 4))
    flow.append(Paragraph(payload["disclaimer"], ss["FDisc"]))

    doc.build(flow)
    return buf.getvalue()


def _describe_heirs(h: dict) -> list[str]:
    out: list[str] = []

    def add(label: str, n) -> None:
        if n:
            out.append(f"{label}" + (f" ({n})" if isinstance(n, int) and n > 1 else ""))

    add("Suami", h.get("husband"))
    add("Istri", h.get("wives"))
    add(_rel_label("anak_laki"), h.get("sons"))
    add(_rel_label("anak_perempuan"), h.get("daughters"))
    add("Ayah", h.get("father"))
    add("Ibu", h.get("mother"))
    add(_rel_label("kakek"), h.get("paternal_grandfather"))
    add(_rel_label("nenek_ayah"), h.get("paternal_grandmother"))
    add(_rel_label("nenek_ibu"), h.get("maternal_grandmother"))
    add(_rel_label("cucu_laki"), h.get("grandsons_via_son"))
    add(_rel_label("cucu_perempuan"), h.get("granddaughters_via_son"))
    add(_rel_label("saudara_laki_kandung"), h.get("full_brothers"))
    add(_rel_label("saudari_kandung"), h.get("full_sisters"))
    add(_rel_label("saudara_laki_seayah"), h.get("paternal_brothers"))
    add(_rel_label("saudari_seayah"), h.get("paternal_sisters"))
    add(_rel_label("saudara_seibu"), h.get("maternal_siblings"))
    for rep in h.get("representatives", []) or []:
        who = _rel_label("anak_laki") if rep.get("replacing") == "son" else _rel_label("anak_perempuan")
        out.append(f"Pengganti dari {who} (cucu L:{rep.get('sons', 0)} P:{rep.get('daughters', 0)})")
    return out
