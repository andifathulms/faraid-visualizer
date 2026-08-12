"""Professional-mode PDF export (PRD §7), language-aware.

Produces the full derivation + citation trail — the artifact a notaris/PPAIW would attach
to a case file. Built with reportlab (no browser needed). Renders from the same serialized
payload the API returns (already localized to the requested language), so the PDF matches
the on-screen derivation and an English PDF is a first-class artifact.

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

from .labels import pdf_text, relation_label, ruleset_label

ACCENT = colors.HexColor("#0d7a5f")
MUTED = colors.HexColor("#6b6b63")


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("FTitle", parent=ss["Title"], fontSize=18, textColor=ACCENT, spaceAfter=2))
    ss.add(ParagraphStyle("FSub", parent=ss["Normal"], fontSize=9, textColor=MUTED, spaceAfter=10))
    ss.add(ParagraphStyle("FH2", parent=ss["Heading2"], fontSize=12, textColor=colors.black, spaceBefore=12, spaceAfter=4))
    ss.add(ParagraphStyle("FBody", parent=ss["Normal"], fontSize=9.5, leading=13, alignment=TA_LEFT))
    ss.add(ParagraphStyle("FSmall", parent=ss["Normal"], fontSize=8, textColor=MUTED, leading=11))
    ss.add(ParagraphStyle("FDisc", parent=ss["Normal"], fontSize=8.5, textColor=colors.HexColor("#7a5b12"), leading=12))
    return ss


def build_pdf(payload: dict, heirs_input: dict | None = None, lang: str = "id") -> bytes:
    T = lambda k: pdf_text(k, lang)  # noqa: E731 - local heading translator
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm, title=T("doc_title"),
    )
    ss = _styles()
    flow = []

    flow.append(Paragraph(T("doc_title"), ss["FTitle"]))
    flow.append(Paragraph(
        f"{T('legal_basis')}: <b>{ruleset_label(payload['ruleset'], lang)}</b>"
        f" &nbsp;·&nbsp; {T('mode_pro')}"
        f" &nbsp;·&nbsp; {T('base')} {payload['pokok_masalah']}"
        + (f" &nbsp;·&nbsp; 'aul → {payload['aul_base']}" if payload["aul_applied"] else "")
        + (" &nbsp;·&nbsp; radd" if payload["radd_applied"] else ""),
        ss["FSub"],
    ))
    if payload.get("beta"):
        flow.append(Paragraph(f"<b>{T('beta')}</b>", ss["FSmall"]))
    flow.append(HRFlowable(width="100%", color=colors.HexColor("#e3e3df")))

    if heirs_input:
        entered = _describe_heirs(heirs_input, lang)
        if entered:
            flow.append(Paragraph(T("heirs_entered"), ss["FH2"]))
            flow.append(Paragraph(", ".join(entered), ss["FBody"]))

    e = payload.get("estate")
    if e and (e["net_divisible"] != e["gross_value"] or float(e["harta_bersama_deducted"]) > 0):
        flow.append(Paragraph(T("divisible"), ss["FH2"]))
        flow.append(Paragraph(
            f"{e['gross_value']} − {e['funeral_costs']} − {e['debts']} − {e['wasiyya']}"
            + (f" − {e['harta_bersama_deducted']}" if float(e["harta_bersama_deducted"]) > 0 else "")
            + f" = <b>{e['net_divisible']}</b>",
            ss["FBody"],
        ))

    # Shares table (payload fields are already localized).
    flow.append(Paragraph(T("distribution"), ss["FH2"]))
    data = [[T("th_heir"), T("th_share"), T("th_perhead"), T("th_category"), T("th_amount")]]
    for s in payload["shares"]:
        data.append([
            s["label"] + (f" ×{s['count']}" if s["count"] > 1 else ""),
            "—" if s["category"] == "harta_bersama" else s["share"]["text"],
            s["per_head"]["text"] if s["count"] > 1 and s["category"] != "harta_bersama" else "—",
            s["category_label"],
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

    # The siham working — the form a practitioner checks their own paper against. Omitted
    # entirely when faraid_web.working could not derive it exactly; a missing section is
    # correct, a section of rounded integers would not be.
    working = payload.get("working")
    if working:
        flow.append(Paragraph(T("working"), ss["FH2"]))
        head = [T("th_heir"), T("th_share"), T("th_siham"), T("th_perhead_siham")]
        wdata = [head]
        for row in working["rows"]:
            wdata.append([
                row["label"] + (f" ×{row['count']}" if row["count"] > 1 else ""),
                row["share"]["text"],
                str(row["siham"]),
                row["per_head_siham"]["text"] if row["count"] > 1 else "—",
            ])
        wdata.append([
            f"<b>{T('total')}</b>",
            "",
            f"<b>{working['total_siham']} / {working['base']}</b>",
            "",
        ])
        # The last row carries markup, so it has to be Paragraphs rather than bare strings.
        wdata[-1] = [Paragraph(c, ss["FSmall"]) if c else "" for c in wdata[-1]]
        wtable = Table(wdata, colWidths=[70 * mm, 30 * mm, 30 * mm, 32 * mm], hAlign="LEFT")
        wtable.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f2ee")),
            ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e3e3df")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        flow.append(wtable)
        if working["aul_applied"]:
            flow.append(Spacer(1, 3))
            flow.append(Paragraph(
                T("working_aul").format(base=working["pokok_masalah"], aul=working["aul_base"]),
                ss["FSmall"],
            ))
        if not working["balanced"]:
            flow.append(Spacer(1, 3))
            flow.append(Paragraph(T("working_unbalanced"), ss["FSmall"]))

    flow.append(Paragraph(T("reasoning"), ss["FH2"]))
    for s in payload["shares"]:
        cite = payload["sources"].get(s["source_id"])
        ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
        flow.append(Paragraph(f"<b>{s['label']}:</b> {s['reason']}{ref}", ss["FSmall"]))
        flow.append(Spacer(1, 2))

    if payload["blocked"]:
        flow.append(Paragraph(T("blocked"), ss["FH2"]))
        for b in payload["blocked"]:
            cite = payload["sources"].get(b["source_id"])
            ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
            flow.append(Paragraph(f"<b>{b['label']}:</b> {b['reason']}{ref}", ss["FSmall"]))

    flow.append(Paragraph(T("steps"), ss["FH2"]))
    for i, st in enumerate(payload["steps"], 1):
        cite = payload["sources"].get(st["source_id"]) if st["source_id"] else None
        ref = f" <font color='#0d7a5f'>[{cite['reference']}]</font>" if cite else ""
        detail = f" {st['detail']}" if (lang == "id" and st["detail"]) else ""
        flow.append(Paragraph(f"{i}. <b>{st['title']}.</b>{detail}{ref}", ss["FSmall"]))
        flow.append(Spacer(1, 2))

    if payload["notes"]:
        flow.append(Paragraph(T("notes"), ss["FH2"]))
        for n in payload["notes"]:
            flow.append(Paragraph(f"• {n}", ss["FSmall"]))
            flow.append(Spacer(1, 2))

    flow.append(Paragraph(T("references"), ss["FH2"]))
    for sid, src in sorted(payload["sources"].items()):
        flow.append(Paragraph(
            f"<b>[{src['pointer']}]</b> {src['reference']}" + (f" — {src['note']}" if src["note"] else ""),
            ss["FSmall"],
        ))
        flow.append(Spacer(1, 2))

    # Coverage limits travel with the document. This PDF is meant to be attachable to a
    # case file, which means it will be read by someone who never saw the app — the one
    # reader who cannot discover from the numbers that a doctrine was omitted.
    gaps = payload.get("coverage_gaps") or []
    silent = [g for g in gaps if g["kind"] == "silent"]
    if gaps:
        flow.append(Paragraph(T("coverage"), ss["FH2"]))
        if silent:
            flow.append(Paragraph(T("coverage_silent"), ss["FSmall"]))
            flow.append(Spacer(1, 2))
        for g in gaps:
            mark = "<b>!</b> " if g["kind"] == "silent" else "• "
            flow.append(Paragraph(
                f"{mark}<b>{g['title']}</b> ({g['kind_label']}) — {g['detail']}"
                f" <font color='#0d7a5f'>[{g['source']['reference']}]</font>",
                ss["FSmall"],
            ))
            flow.append(Spacer(1, 2))

    flow.append(Spacer(1, 8))
    flow.append(HRFlowable(width="100%", color=colors.HexColor("#e8c982")))
    flow.append(Spacer(1, 4))
    flow.append(Paragraph(payload["disclaimer"], ss["FDisc"]))

    doc.build(flow)
    return buf.getvalue()


def _describe_heirs(h: dict, lang: str) -> list[str]:
    out: list[str] = []

    def add(label_id: str, n) -> None:
        if n:
            label = relation_label(label_id, lang)
            out.append(label + (f" ({n})" if isinstance(n, int) and n > 1 else ""))

    add("suami", h.get("husband"))
    add("istri", h.get("wives"))
    add("anak_laki", h.get("sons"))
    add("anak_perempuan", h.get("daughters"))
    add("ayah", h.get("father"))
    add("ibu", h.get("mother"))
    add("kakek", h.get("paternal_grandfather"))
    add("nenek_ayah", h.get("paternal_grandmother"))
    add("nenek_ibu", h.get("maternal_grandmother"))
    add("cucu_laki", h.get("grandsons_via_son"))
    add("cucu_perempuan", h.get("granddaughters_via_son"))
    add("saudara_laki_kandung", h.get("full_brothers"))
    add("saudari_kandung", h.get("full_sisters"))
    add("saudara_laki_seayah", h.get("paternal_brothers"))
    add("saudari_seayah", h.get("paternal_sisters"))
    add("saudara_seibu", h.get("maternal_siblings"))
    for rep in h.get("representatives", []) or []:
        who = relation_label("anak_laki" if rep.get("replacing") == "son" else "anak_perempuan", lang)
        out.append(f"{who} → L:{rep.get('sons', 0)} P:{rep.get('daughters', 0)}")
    return out
