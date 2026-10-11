import re

filepath = r"blog-serum-protein-test-sdp.html"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Step 1: Clean up any previously added section tags (from broken runs)
# Remove any <section class="mb-24 scroll-mt-24"> and </section> we may have inserted
content = re.sub(r'\n {20}<section class="mb-24 scroll-mt-24">\n', '\n', content)
content = re.sub(r'\n {20}</section>\n', '\n', content)
# Also handle cases with different spacing
content = re.sub(r'[ \t]*<section class="mb-24 scroll-mt-24">\n', '', content)
content = re.sub(r'[ \t]*</section>\n', '', content)

# Step 2: Find all blog-style H2 positions in article area
end_marker = '                    <div class="mt-16 pt-8 border-t border-gray-200">'
end_idx = content.find(end_marker)

h2_positions = []
for m in re.finditer(r' {20}<h2\n', content):
    pos = m.start()
    if pos < end_idx:
        chunk = content[pos:pos+200]
        if 'text-4xl font-bold text-gray-900 mt-16' in chunk:
            h2_positions.append(pos)

print(f"Found {len(h2_positions)} clean H2 sections")

if not h2_positions:
    print("No H2s found after cleanup")
    exit()

# Step 3: Build new content
before = content[:h2_positions[0]]
after = content[end_idx:]

sections_html = ""
for i, pos in enumerate(h2_positions):
    next_pos = h2_positions[i+1] if i+1 < len(h2_positions) else end_idx
    chunk = content[pos:next_pos].rstrip('\r\n ')
    sections_html += '\n                    <section class="mb-24 scroll-mt-24">\n'
    sections_html += chunk
    sections_html += '\n                    </section>\n'

new_content = before + sections_html + '\n' + after

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done!")
print(f"New file size: {len(new_content)} chars")

# Quick verify
verify_count = new_content.count('<section class="mb-24 scroll-mt-24">')
print(f"Section open tags in output: {verify_count}")
close_count = new_content.count('</section>')
print(f"Section close tags in output: {close_count}")
