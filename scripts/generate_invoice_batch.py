import json
import re
import zipfile
from datetime import date
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "tmp" / "pdfs" / "invoice-data-2026.json"
OUTPUT_DIR = ROOT / "output" / "pdf" / "mitgliedsrechnungen-2026"
ZIP_FILE = ROOT / "output" / "pdf" / "PROdigitalTV-Mitgliedsrechnungen-2026.zip"
LOGO = ROOT / "public" / "assets" / "official" / "brand" / "prodigitaltv-logo-claim.png"
PAGE_SIZE = (595.32, 841.92)
GERMAN_MONTHS = ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]


def register_fonts():
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Invoice", str(regular)))
        pdfmetrics.registerFont(TTFont("Invoice-Bold", str(bold)))
        return "Invoice", "Invoice-Bold"
    return "Helvetica", "Helvetica-Bold"


REGULAR, BOLD = register_fonts()


def money(cents):
    value = f"{int(cents) / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{value} €"


def german_date(value):
    parsed = date.fromisoformat(value)
    return f"{parsed.day}. {GERMAN_MONTHS[parsed.month]} {parsed.year}"


def safe_filename(value):
    return re.sub(r'[<>:"/\\|?*]+', "-", value).strip().rstrip(".")


def fitted_font_size(text, font, maximum, width, minimum=7.5):
    size = maximum
    while size > minimum and pdfmetrics.stringWidth(text, font, size) > width:
        size -= 0.25
    return size


def draw_invoice(item, path):
    width, height = PAGE_SIZE
    c = canvas.Canvas(str(path), pagesize=PAGE_SIZE)
    title = f"RECHNUNG {item['invoice_number']} MB - {item['member_name']}"
    c.setTitle(title)
    c.setAuthor("PROdigitalTV")
    c.drawImage(str(LOGO), 330, 756, width=210, height=42, preserveAspectRatio=True, mask="auto")

    x = 56
    c.setFillColor(black)
    c.setFont(REGULAR, 7.3)
    c.drawString(x, 697, "PROdigitalTV e.V. - Wandalenweg 26 - 20097 Hamburg - Deutschland")

    recipient = [item["member_name"], item.get("contact_name", ""), item["street"], item["postal_city"]]
    c.setFont(REGULAR, 10.5)
    y = 664
    for line in filter(None, recipient):
        c.drawString(x, y, line)
        y -= 15
    y -= 10
    if item.get("email"):
        c.drawString(x, y, item["email"])

    c.drawRightString(515, 578, f"Hamburg, den {german_date(item['invoice_date'])}")

    c.setFont(BOLD, fitted_font_size(title, BOLD, 10.5, 477))
    c.drawString(x, 548, title)

    c.setFont(REGULAR, 10.5)
    c.drawString(x, 520, item["salutation"])
    c.drawString(x, 492, "wir möchten uns bei Ihnen für Ihre Mitgliedschaft bei PROdigitalTV bedanken und übersenden Ihnen die")
    c.drawString(x, 477, "Rechnung über Ihren Mitgliedsbeitrag für das Jahr 2026.")

    red = HexColor("#c90000")
    table_x, table_y, table_w, row_h = x, 419, 477, 28
    columns = [163, 157, 157]
    c.setFillColor(red)
    c.rect(table_x, table_y + row_h / 2, table_w, row_h / 2, stroke=0, fill=1)
    c.setStrokeColor(black)
    c.rect(table_x, table_y, table_w, row_h, stroke=1, fill=0)
    cursor = table_x
    for column in columns[:-1]:
        cursor += column
        c.line(cursor, table_y, cursor, table_y + row_h)
    c.setFillColor(white)
    c.setFont(BOLD, 9.5)
    c.drawString(table_x + 6, table_y + 17, "Position")
    c.drawString(table_x + columns[0] + 6, table_y + 17, "Kategorie")
    c.drawRightString(table_x + table_w - 6, table_y + 17, "Beitrag in €")
    c.setFillColor(black)
    c.setFont(REGULAR, 9.5)
    c.drawString(table_x + 6, table_y + 4, "Mitgliederbeitrag 2026")
    category_size = fitted_font_size(item["category"], REGULAR, 9.5, columns[1] - 12, 7.5)
    c.setFont(REGULAR, category_size)
    c.drawString(table_x + columns[0] + 6, table_y + 4, item["category"])
    c.setFont(REGULAR, 9.5)
    c.drawRightString(table_x + table_w - 6, table_y + 4, money(item["amount_cents"]))

    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(x, 399, "Umsatzsteuerbefreit durch Eintrag in das Hamburger Vereinsregister unter der Nr. VR-Hamburg 19974")

    c.setFont(REGULAR, 10.5)
    intro = "Bitte überweisen Sie den Betrag von "
    c.drawString(x, 374, intro)
    amount_x = x + c.stringWidth(intro, REGULAR, 10.5)
    c.setFont(BOLD, 10.5)
    amount = money(item["amount_cents"])
    c.drawString(amount_x, 374, amount)
    account_x = amount_x + c.stringWidth(amount, BOLD, 10.5)
    c.setFont(REGULAR, 10.5)
    c.drawString(account_x, 374, " auf unser Konto bei der Hypo Vereinsbank")

    c.drawString(x, 345, "Kontoinhaber:   PROdigitalTV")
    c.drawString(x, 330, "IBAN              DE86100208900031410797")
    c.drawString(x, 315, "BIC                HYVEDEMM488")
    c.drawString(x, 260, "Mit freundlichen Grüßen")
    c.drawString(x, 220, "PROdigitalTV")
    c.drawString(x, 205, "Beate Busch")
    c.drawString(x, 190, "Vorsitzende des Vorstandes")

    c.setFont("Times-Roman", 8.5)
    c.drawCentredString(width / 2, 85, "PROdigitalTV - Interessengemeinschaft Digitale Medien e.V.   -   VR Hamburg 19974")
    c.drawCentredString(width / 2, 73, "Sitz des Vereins: Wandalenweg 26 - 20097 Hamburg - Deutschland")
    c.drawCentredString(width / 2, 61, "Vorsitzende des Vorstandes: Beate Busch")
    c.setFillColor(HexColor("#0000ee"))
    c.drawCentredString(width / 2, 49, "www.prodigitaltv.de - post@prodigitaltv.de")
    c.save()


def validate_pdf(path, item):
    reader = PdfReader(str(path))
    if len(reader.pages) != 1:
        raise ValueError(f"{path.name}: unerwartete Seitenzahl")
    page = reader.pages[0]
    widgets = [a for a in (page.get("/Annots") or []) if a.get_object().get("/Subtype") == "/Widget"]
    if widgets:
        raise ValueError(f"{path.name}: unerwartete Formularfelder")
    text = page.extract_text() or ""
    for expected in [item["invoice_number"], item["member_name"], money(item["amount_cents"])]:
        if expected not in text:
            raise ValueError(f"{path.name}: Text fehlt: {expected}")


def main():
    items = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if len(items) != 31:
        raise ValueError(f"31 Rechnungen erwartet, {len(items)} erhalten")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUTPUT_DIR.glob("*.pdf"):
        old.unlink()
    paths = []
    for item in items:
        filename = safe_filename(f"RECHNUNG {item['invoice_number']} MB - {item['member_name']}.pdf")
        path = OUTPUT_DIR / filename
        draw_invoice(item, path)
        validate_pdf(path, item)
        paths.append(path)
    with zipfile.ZipFile(ZIP_FILE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, arcname=path.name)
    print(json.dumps({"pdf_count": len(paths), "zip": str(ZIP_FILE), "files": [str(p) for p in paths]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
