from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from io import BytesIO, StringIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def render_csv(rows: list[list[object]]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerows(rows)
    return buffer.getvalue()


def render_professional_pdf(
    title: str,
    subtitle: str | None = None,
    metadata: list[tuple[str, str]] | None = None,
    tables: list[dict[str, Any]] | None = None,
    orientation: str = "portrait",
) -> bytes:
    """
    Renders a professional PDF using ReportLab.
    
    tables: list of dictionaries, e.g.:
    {
        "title": "Usage by Model",
        "headers": ["Model", "Tokens", "Cost"],
        "rows": [["GPT-4", "1000", "$0.03"], ...],
        "col_widths": [2*inch, 1*inch, 1*inch] # optional
    }
    """
    buffer = BytesIO()
    pagesize = landscape(A4) if orientation == "landscape" else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        "TracklyTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#10b981"),  # Emerald-500
        spaceAfter=12,
        fontName="Helvetica-Bold",
    )
    
    header_style = ParagraphStyle(
        "TracklyHeader",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#4f46e5"),  # Indigo-600
        spaceBefore=20,
        spaceAfter=10,
        fontName="Helvetica-Bold",
    )
    
    normal_style = styles["Normal"]
    meta_style = ParagraphStyle(
        "TracklyMeta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#6b7280"),  # Gray-500
        fontName="Helvetica",
    )

    story = []

    # Logo and Branding
    logo_path = os.path.join(os.getcwd(), "frontend", "public", "logo", "logo-96.png")
    if os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=0.5 * inch, height=0.5 * inch)
            img.hAlign = "LEFT"
            story.append(img)
        except Exception:
            pass
    
    story.append(Paragraph("Trackly", title_style))
    story.append(Paragraph(title, styles["Heading2"]))
    if subtitle:
        story.append(Paragraph(subtitle, normal_style))
    
    story.append(Spacer(1, 10))

    # Metadata (Filters, Generation Time)
    if metadata:
        meta_data = []
        for key, value in metadata:
            meta_data.append([Paragraph(f"<b>{key}:</b>", meta_style), Paragraph(value, meta_style)])
        
        meta_table = Table(meta_data, colWidths=[1.2 * inch, 4 * inch])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ]))
        story.append(meta_table)

    story.append(Spacer(1, 20))

    # Tables
    if tables:
        for t_info in tables:
            if t_info.get("title"):
                story.append(Paragraph(t_info["title"], header_style))
            
            headers = t_info.get("headers", [])
            rows = t_info.get("rows", [])
            data = [headers] + rows
            
            # Table configuration
            col_widths = t_info.get("col_widths")
            if not col_widths:
                # Basic auto-sizing logic for A4
                avail_width = pagesize[0] - 80
                num_cols = len(headers)
                if num_cols > 0:
                    col_widths = [avail_width / num_cols] * num_cols

            # Wrap headers and rows in Paragraphs to support wrapping
            cell_style = ParagraphStyle(
                "TableCell",
                parent=normal_style,
                fontSize=9,
                leading=10,
                wordWrap='CJK', # Good for long names
            )
            header_cell_style = ParagraphStyle(
                "TableHeaderCell",
                parent=cell_style,
                textColor=colors.whitesmoke,
                fontName="Helvetica-Bold",
            )
            
            wrapped_data = [[Paragraph(str(h), header_cell_style) for h in headers]]
            for r in rows:
                wrapped_data.append([Paragraph(str(cell), cell_style) for cell in r])

            table = Table(wrapped_data, colWidths=col_widths, repeatRows=1)
            
            # Styling for professional look
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1f2937")), # Gray-800
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f9fafb")), # Gray-50
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")), # Gray-200
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ]))
            story.append(table)
            story.append(Spacer(1, 15))

    # Footer (Page numbers handled by DocTemplate or Canvas)
    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setStrokeColor(colors.gray)
        canvas.line(40, 30, pagesize[0] - 40, 30)
        page_num = f"Page {doc.page}"
        canvas.drawRightString(pagesize[0] - 40, 20, page_num)
        canvas.drawString(40, 20, f"Generated at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return buffer.getvalue()


# Keep old function for temporary backward compatibility during refactor
def render_text_pdf(title: str, lines: list[str]) -> bytes:
    """Legacy text-only PDF - will be deprecated after router refactor."""
    # Convert lines to a basic table for better output than the raw bytecode version
    return render_professional_pdf(
        title=title,
        tables=[{
            "headers": ["Content"],
            "rows": [[line] for line in lines]
        }]
    )
