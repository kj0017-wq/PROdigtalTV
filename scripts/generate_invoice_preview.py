from pathlib import Path

from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\Klaus-HP\Dropbox\PROdigitalTV\05 Rechnungen Eingangs und Ausgangsrechnungen\2026 Rechnungswesen\Mietgliederrechnungen 2026\RECHNUNG 2026-001 MB - Bibel TV Stiftung gGmbH.pdf")
OUTPUT = ROOT / "output" / "pdf" / "RECHNUNG 2026-002 MB - Channel 21 GmbH - VORSCHAU.pdf"
LOGO = ROOT / "public" / "assets" / "official" / "brand" / "prodigitaltv-logo-claim.png"

DATA = {
    "member_name": "Channel 21 GmbH",
    "contact_name": "Birgit Zimmerhofer",
    "street": "Grosser Kolonnenweg 18 d",
    "postal_city": "D-30163 Hannover",
    "email": "buchhaltung@channel21.de",
    "invoice_number": "2026-002",
    "invoice_date": "1. Januar 2026",
    "salutation": "Sehr geehrte Frau Zimmerhofer,",
    "category": "Unternehmensmitgliedschaft",
    "amount": "800,00 €",
}


def register_fonts():
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Invoice", str(regular)))
        pdfmetrics.registerFont(TTFont("Invoice-Bold", str(bold)))
        return "Invoice", "Invoice-Bold"
    return "Helvetica", "Helvetica-Bold"


def draw_invoice(width=595.32, height=841.92):
    regular, bold = register_fonts()
    c = canvas.Canvas(str(OUTPUT), pagesize=(width, height))
    c.setTitle("RECHNUNG 2026-002 MB - Channel 21 GmbH - VORSCHAU")
    c.setAuthor("PROdigitalTV")
    c.drawImage(str(LOGO), 330, 756, width=210, height=42, preserveAspectRatio=True, mask="auto")

    x = 56
    c.setFillColor(black)
    c.setFont(regular, 7.3)
    c.drawString(x, 697, "PROdigitalTV e.V. - Wandalenweg 26 - 20097 Hamburg - Deutschland")
    c.setFont(regular, 10.5)
    y = 664
    for line in [DATA["member_name"], DATA["contact_name"], DATA["street"], DATA["postal_city"]]:
        c.drawString(x, y, line)
        y -= 15
    y -= 10
    c.drawString(x, y, DATA["email"])

    c.drawRightString(515, 578, f"Hamburg, den {DATA['invoice_date']}")

    c.setFont(bold, 10.5)
    c.drawString(x, 548, f"RECHNUNG {DATA['invoice_number']} MB - {DATA['member_name']}")

    c.setFont(regular, 10.5)
    c.drawString(x, 520, DATA["salutation"])
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
    c.setFont(bold, 9.5)
    c.drawString(table_x + 6, table_y + 17, "Position")
    c.drawString(table_x + columns[0] + 6, table_y + 17, "Kategorie")
    c.drawRightString(table_x + table_w - 6, table_y + 17, "Beitrag in €")
    c.setFillColor(black)
    c.setFont(regular, 9.5)
    c.drawString(table_x + 6, table_y + 4, "Mitgliederbeitrag 2026")
    c.drawString(table_x + columns[0] + 6, table_y + 4, DATA["category"])
    c.drawRightString(table_x + table_w - 6, table_y + 4, DATA["amount"])

    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(x, 399, "Umsatzsteuerbefreit durch Eintrag in das Hamburger Vereinsregister unter der Nr. VR-Hamburg 19974")

    c.setFont(regular, 10.5)
    payment_intro = "Bitte überweisen Sie den Betrag von "
    c.drawString(x, 374, payment_intro)
    amount_x = x + c.stringWidth(payment_intro, regular, 10.5)
    c.setFont(bold, 10.5)
    c.drawString(amount_x, 374, DATA["amount"])
    account_x = amount_x + c.stringWidth(DATA["amount"], bold, 10.5)
    c.setFont(regular, 10.5)
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


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    draw_invoice()
    print(OUTPUT)


if __name__ == "__main__":
    main()
