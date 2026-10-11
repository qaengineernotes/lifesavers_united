import glob, re

sub_blogs = [
    'blog-blood-donation-deferrals-tattoos-surgery.html',
    'blog-blood-donation-diabetes-high-bp-chronic-illness.html',
    'blog-womens-health-blood-donation-rules.html',
    'blog-blood-donation-medications-vaccines-waiting-time.html',
    'blog-blood-screening-tti-recall-ic-tc-referral.html'
]

for fname in sub_blogs:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Remove S.No references like (S.No. 43), (S.No. 19), (S.No. 16 - 18), (S.No. 4), (S.No. 9), etc.
    text = re.sub(r'\(S\.No\.\s*\d+[^)]*\)', '', text)
    text = re.sub(r'\(S\.No\.\s*\d+\s*-\s*\d+[^)]*\)', '', text)
    text = re.sub(r'S\.No\.\s*\d+\s*', '', text)
    text = re.sub(r'Page\s*\d+', '', text)

    with open(fname, 'w', encoding='utf-8') as f:
        f.write(text)

    print(f"Cleaned {fname}")
