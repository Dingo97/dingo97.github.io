"""Build both public CVs from content/cv.json. Requires reportlab and a sans font.

Usage: python scripts/build-cv.py [--font-dir /path/to/arial-or-dejavu-fonts]
The checked-in PDFs are served directly by GitHub Pages.
"""
import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--font-dir', type=Path)
args = parser.parse_args()
candidates = [args.font_dir] if args.font_dir else [Path('C:/Windows/Fonts'), Path('/usr/share/fonts/truetype/dejavu')]
for folder in candidates:
    for normal, bold in [('arial.ttf', 'arialbd.ttf'), ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf')]:
        if (folder / normal).exists() and (folder / bold).exists():
            pdfmetrics.registerFont(TTFont('CV', str(folder / normal)))
            pdfmetrics.registerFont(TTFont('CV-Bold', str(folder / bold)))
            break
    else:
        continue
    break
else:
    raise SystemExit('Arial or DejaVu Sans is required. Pass --font-dir.')
pdfmetrics.registerFontFamily('CV', normal='CV', bold='CV-Bold', italic='CV', boldItalic='CV-Bold')

INK = colors.HexColor('#182018')
MUTED = colors.HexColor('#4D594B')
GREEN = colors.HexColor('#446326')
LINE = colors.HexColor('#D9DFD3')
W, H = A4
MARGIN = 43
WIDTH = W - 2 * MARGIN - 12
styles = {
    'name': ParagraphStyle('name', fontName='CV-Bold', fontSize=27, leading=31, textColor=INK, spaceAfter=5),
    'role': ParagraphStyle('role', fontName='CV-Bold', fontSize=11.5, leading=15, textColor=GREEN, spaceAfter=9),
    'contact': ParagraphStyle('contact', fontName='CV', fontSize=8.1, leading=12, textColor=MUTED, spaceAfter=1),
    'body': ParagraphStyle('body', fontName='CV', fontSize=9, leading=12.1, textColor=INK, spaceAfter=3),
    'bullet': ParagraphStyle('bullet', fontName='CV', fontSize=9, leading=12.1, textColor=INK, leftIndent=9, firstLineIndent=-8, spaceAfter=2),
    'section': ParagraphStyle('section', fontName='CV-Bold', fontSize=9, leading=12, textColor=GREEN, spaceBefore=11, spaceAfter=6, keepWithNext=True),
    'job': ParagraphStyle('job', fontName='CV-Bold', fontSize=10, leading=13, textColor=INK),
    'date': ParagraphStyle('date', fontName='CV', fontSize=8.5, leading=13, textColor=MUTED, alignment=TA_RIGHT),
    'subtitle': ParagraphStyle('subtitle', fontName='CV', fontSize=9, leading=12, textColor=MUTED, spaceAfter=4),
}
data = json.loads((ROOT / 'content/cv.json').read_text(encoding='utf-8'))

def p(text, style='body'):
    return Paragraph(text, styles[style])

def heading(title, date, url=None):
    text = escape(title)
    if url:
        text = f'<a href="{escape(url)}" color="#182018">{text}</a>'
    table = Table([[p(text, 'job'), p(escape(date), 'date')]], colWidths=[WIDTH - 116, 116])
    table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return table

def build(lang):
    c = data[lang]
    filename = 'CV_Davide_Di_Matteo' + ('_IT' if lang == 'it' else '') + '.pdf'
    output = ROOT / filename
    story = [p(escape(data['name']), 'name'), p(escape(data['role']), 'role')]
    story.append(p(f"{c['location']}  /  {data['phone']}  /  <a href='mailto:{data['email']}'>{data['email']}</a>", 'contact'))
    website = data['website'] + ('it/' if lang == 'it' else '')
    story.append(p(f"<a href='{website}'>dingo97.github.io</a>  /  <a href='{data['linkedin']}'>linkedin.com/in/davide-di-matteo</a>  /  <a href='{data['github']}'>github.com/Dingo97</a>", 'contact'))
    story.extend([Spacer(1, 9), p(escape(c['profile']))])
    story.append(p(c['sections'][0].upper(), 'section'))
    for job in c['jobs']:
        block = [heading(job['company'], job['date']), p(escape(job['role']), 'subtitle')]
        block.extend(p('- ' + escape(b), 'bullet') for b in job['bullets'])
        block.append(Spacer(1, 4))
        story.append(KeepTogether(block))
    story.append(p(c['sections'][1].upper(), 'section'))
    for research in c['research']:
        story.append(KeepTogether([heading(research['title'], research['date'], research['url']), p(escape(research['text'])), Spacer(1, 4)]))
    story.extend([p(c['sections'][2].upper(), 'section'), p('<b>' + escape(c['education']) + '</b>'), p(escape(c['thesis'])), p(c['certifications'])])
    story.append(p(c['sections'][3].upper(), 'section'))
    for label, text in c['skills']:
        story.append(p(f'<b>{escape(label)}:</b> {escape(text)}'))

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#C5F277'))
        canvas.rect(MARGIN, H - 27, 43, 4, fill=1, stroke=0)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 33, W - MARGIN, 33)
        canvas.setFont('CV', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 21, f"Davide Di Matteo / {c['updated']}")
        canvas.drawRightString(W - MARGIN, 21, f"{lang.upper()} / {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=40, bottomMargin=43, title=f"Davide Di Matteo - Curriculum Vitae ({lang.upper()})", author=data['name'], subject='Cybersecurity, vulnerability management and independent research', pageCompression=1)
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    print(f'Built {filename}')

for language in ['en', 'it']:
    build(language)
