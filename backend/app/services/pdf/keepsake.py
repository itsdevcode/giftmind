import io

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from app.models.story import StoryKeepsake

# Palette definitions for timeless elegant keepsake
COLOR_PRIMARY = HexColor("#4A2E18")  # Warm deep mahogany / espresso
COLOR_ACCENT = HexColor("#9C413D")  # Rich burgundy / rosewood
COLOR_TEXT = HexColor("#2D241E")  # Soft charcoal brown
COLOR_MUTED = HexColor("#766A65")  # Subdued taupe
COLOR_BORDER = HexColor("#E5DDD5")  # Subtle cream border
COLOR_GOLD = HexColor("#C29B38")  # Elegant warm gold


class NumberedCanvas(canvas.Canvas):
    """Custom canvas that collects pages and adds subtle footer & running page numbers."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int) -> None:
        # Cover page (page 1) has no headers/footers
        if self._pageNumber == 1:
            # Draw subtle double border on cover
            self.saveState()
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(1)
            self.rect(36, 36, A4[0] - 72, A4[1] - 72)
            self.setStrokeColor(COLOR_GOLD)
            self.setLineWidth(0.5)
            self.rect(40, 40, A4[0] - 80, A4[1] - 80)
            self.restoreState()
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)

        # Header running line and mark
        page_w, page_h = A4
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(54, page_h - 40, page_w - 54, page_h - 40)
        self.drawString(54, page_h - 35, "GiftMind Keepsake Collection")

        # Footer running line and page count
        self.line(54, 45, page_w - 54, 45)
        self.drawRightString(page_w - 54, 32, f"Page {self._pageNumber} of {page_count}")
        self.drawString(54, 32, "A Story Written From the Heart")
        self.restoreState()


def generate_story_keepsake_pdf(
    story: StoryKeepsake,
    recipient_name: str,
    occasion: str = "",
) -> bytes:
    """Generate an elegant, publication-quality A4 PDF keepsake for the story in-memory."""
    buffer = io.BytesIO()

    # Document setup with generous margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    cover_title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=32,
        alignment=TA_CENTER,
        textColor=COLOR_PRIMARY,
        spaceAfter=15,
    )

    cover_subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        alignment=TA_CENTER,
        textColor=COLOR_ACCENT,
        spaceAfter=25,
    )

    dedication_style = ParagraphStyle(
        "Dedication",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=11,
        leading=17,
        alignment=TA_CENTER,
        textColor=COLOR_TEXT,
        spaceAfter=30,
    )

    story_heading_style = ParagraphStyle(
        "StoryHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=24,
        alignment=TA_LEFT,
        textColor=COLOR_PRIMARY,
        spaceAfter=15,
    )

    story_body_style = ParagraphStyle(
        "StoryBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=17,
        alignment=TA_JUSTIFY,
        textColor=COLOR_TEXT,
        spaceAfter=12,
    )

    closing_style = ParagraphStyle(
        "ClosingMessage",
        parent=styles["Normal"],
        fontName="Helvetica-BoldOblique",
        fontSize=11,
        leading=17,
        alignment=TA_LEFT,
        textColor=COLOR_ACCENT,
        spaceBefore=20,
        spaceAfter=15,
    )

    brand_mark_style = ParagraphStyle(
        "BrandMark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=COLOR_MUTED,
        spaceBefore=40,
    )

    def escape_xml(s: str) -> str:
        """Escape text safely for ReportLab paragraph XML parser."""
        if not s:
            return ""
        return (
            s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;")
        )

    story_elements: list[Paragraph | Spacer | PageBreak] = []

    # --- COVER PAGE ---
    story_elements.append(Spacer(1, 1.8 * inch))
    story_elements.append(Paragraph("A PERSONALIZED KEEPSAKE STORY", brand_mark_style))
    story_elements.append(Spacer(1, 0.3 * inch))
    story_elements.append(Paragraph(escape_xml(story.title), cover_title_style))

    sub_line = f"Presented with Love to {escape_xml(recipient_name)}"
    if occasion:
        sub_line += f"<br/>On the Occasion of {escape_xml(occasion)}"
    story_elements.append(Paragraph(sub_line, cover_subtitle_style))

    story_elements.append(Spacer(1, 0.4 * inch))
    # Dedicated section
    if story.dedication:
        story_elements.append(
            Paragraph(f"&ldquo;{escape_xml(story.dedication)}&rdquo;", dedication_style)
        )

    story_elements.append(Spacer(1, 1.2 * inch))
    story_elements.append(
        Paragraph("GiftMind Keepsake Edition &bull; Curated with Heart", brand_mark_style)
    )

    # Page Break to Story Body
    story_elements.append(PageBreak())

    # --- INNER STORY PAGES ---
    story_elements.append(Paragraph(escape_xml(story.title), story_heading_style))
    story_elements.append(Spacer(1, 0.15 * inch))

    # Split paragraphs by double newline
    paragraphs = [p.strip() for p in story.story_body.split("\n") if p.strip()]
    for p in paragraphs:
        story_elements.append(Paragraph(escape_xml(p), story_body_style))

    # Closing message
    if story.closing_message:
        story_elements.append(Spacer(1, 0.2 * inch))
        story_elements.append(Paragraph(escape_xml(story.closing_message), closing_style))

    # Build the document with our custom NumberedCanvas
    doc.build(story_elements, canvasmaker=NumberedCanvas)

    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
