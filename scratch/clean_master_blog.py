import re

def clean_master_blog():
    with open('blog-revised-blood-donation-rules-india-2025.html', 'r', encoding='utf-8') as f:
        text = f.read()

    # Meta keywords & descriptions
    text = text.replace('S.No 1 to 95 DGHS guidelines, ', '')
    text = text.replace('full S.No. 1 to 95 deferral tables', 'full medical deferral tables')
    text = text.replace('33-page National Blood Transfusion Council', 'National Blood Transfusion Council')
    text = text.replace('33-page comprehensive regulatory document', 'comprehensive national regulatory document')
    text = text.replace('33-Page NBTC & DGHS Document.', 'NBTC & DGHS Guidelines.')
    text = text.replace('33-page official PDF (`Revised donor selection and referral criteria feb 2025.pdf`)', 'official DGHS & NBTC Guidelines document')
    text = text.replace('<li><strong>Total Document Pages:</strong> 33 Pages</li>', '<li><strong>Status:</strong> Active National Standard</li>')
    text = text.replace('S.No. 1 to 95+', 'all medical conditions')

    # Page references in body
    text = text.replace('Page 3 of the official PDF details', 'Official DGHS guidelines detail')
    text = text.replace('Pages 3 to 6 of the document outline', 'The national guidelines outline')
    text = text.replace('Pages 7 to 9 contain the core physical criteria table required for every prospective donor:', 'The core physical criteria required for every prospective donor are summarized below:')
    text = text.replace('Pages 9 to 15 of the PDF contain the complete master medical condition listing. Below is a 1-to-2 line summary of every single condition:', 'The complete master medical condition listing and clinical deferral periods are summarized below:')
    text = text.replace('Pages 16 to 18 of the guidelines standardize the national referral protocol', 'The national guidelines standardize the referral protocol')
    text = text.replace('Pages 19 – 33', 'Overview of Personnel Roles & Annexures')
    text = text.replace('The concluding annexures of the February 2025 document establish administrative and operational guidelines:', 'The official administrative annexures establish operational guidelines:')
    text = text.replace('(S.No. 1 to 15)', '')

    # Table S.No header and rows
    text = text.replace('<th class="py-2 px-3 font-semibold border">S.No.</th>', '<th class="py-2 px-3 font-semibold border">#</th>')

    # Strip S.No. X patterns in text
    # e.g. S.No. 16 (Pregnancy) -> Pregnancy
    text = re.sub(r'<strong>S\.No\.\s*\d+[^<]*\(([^)]+)\):?</strong>', r'<strong>\1:</strong>', text)
    text = re.sub(r'<strong>S\.No\.\s*\d+[^<]*–[^<]*\d+[^<]*\(([^)]+)\):?</strong>', r'<strong>\1:</strong>', text)
    text = re.sub(r'<strong>S\.No\.\s*\d+[^<]*:?</strong>', '', text)
    text = re.sub(r'\(S\.No\.\s*\d+[^)]*\)', '', text)
    text = re.sub(r'\(S\.No\.\s*\d+[^)]*–[^)]*\d+\)', '', text)
    text = re.sub(r'S\.No\.\s*\d+–\d+\s*', '', text)
    text = re.sub(r'S\.No\.\s*\d+\s*', '', text)

    with open('blog-revised-blood-donation-rules-india-2025.html', 'w', encoding='utf-8') as f:
        f.write(text)

    print("Cleaned blog-revised-blood-donation-rules-india-2025.html")

clean_master_blog()
