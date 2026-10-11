import glob, re, json

files = [
    'blog-revised-blood-donation-rules-india-2025.html',
    'blog-blood-donation-deferrals-tattoos-surgery.html',
    'blog-blood-donation-diabetes-high-bp-chronic-illness.html',
    'blog-blood-donation-medications-vaccines-waiting-time.html',
    'blog-womens-health-blood-donation-rules.html',
    'blog-blood-screening-tti-recall-ic-tc-referral.html'
]

for fname in files:
    with open(fname, 'r', encoding='utf-8') as f:
        html = f.read()
    
    title = re.search(r'<title>(.*?)</title>', html, re.DOTALL)
    title_text = title.group(1).strip() if title else 'MISSING'
    
    desc = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
    desc_text = desc.group(1).strip() if desc else 'MISSING'
    
    canonical = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']', html, re.IGNORECASE)
    canonical_text = canonical.group(1).strip() if canonical else 'MISSING'
    
    h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.IGNORECASE)
    
    schemas = []
    for s in re.findall(r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(s.strip())
            schemas.append(data.get('@type', 'Unknown'))
        except Exception as e:
            schemas.append(f'INVALID JSON: {e}')
            
    og_title = bool(re.search(r'<meta\s+property=["\']og:title["\']', html, re.IGNORECASE))
    og_desc = bool(re.search(r'<meta\s+property=["\']og:description["\']', html, re.IGNORECASE))
    og_img = bool(re.search(r'<meta\s+property=["\']og:image["\']', html, re.IGNORECASE))
    tw_card = bool(re.search(r'<meta\s+name=["\']twitter:card["\']', html, re.IGNORECASE))
    
    print(f"=== {fname} ===")
    print(f"Title ({len(title_text)} chars): {title_text}")
    print(f"Meta Description ({len(desc_text)} chars): {desc_text}")
    print(f"Canonical URL: {canonical_text}")
    print(f"H1 Count: {len(h1s)} -> '{h1s[0].strip() if h1s else 'NONE'}'")
    print(f"Open Graph Tags: og:title={og_title}, og:desc={og_desc}, og:image={og_img}")
    print(f"Twitter Cards: twitter:card={tw_card}")
    print(f"Schemas Found: {schemas}")
    print(f"Word Count: {len(re.sub('<[^<]+?>', '', html).split())} words")
    print()
