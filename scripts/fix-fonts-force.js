const fs = require('fs');
const path = require('path');
const rootDir = process.cwd();

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (filePath.includes('.git') || filePath.includes('node_modules')) return;
        if (fs.statSync(filePath).isDirectory()) {
            filelist = walkSync(filePath, filelist);
        } else if (filePath.endsWith('.html')) {
            filelist.push(filePath);
        }
    });
    return filelist;
};

const files = walkSync(rootDir);
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    const regex = /<!-- Preconnect for Google Fonts -->[\s\S]*?(?=<!-- Structured Data)/i;
    
    const perfectBlock = `<!-- Preconnect for Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <!-- Load combined fonts with display=swap + preload trick to prevent render blocking -->
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Crimson+Text:wght@400;600&display=swap" as="style" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Crimson+Text:wght@400;600&display=swap" media="print" onload="this.media='all'" />
    <noscript>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Crimson+Text:wght@400;600&display=swap" />
    </noscript>

    `;
    
    if (regex.test(content)) {
        content = content.replace(regex, perfectBlock);
    }
    
    const mainCssRegex = /(<link rel="preload" as="style" href="css\/main\.css">\s*)+<link rel="stylesheet" href="css\/main\.css">/gi;
    content = content.replace(mainCssRegex, `<link rel="preload" as="style" href="css/main.css">\n    <link rel="stylesheet" href="css/main.css">`);

    fs.writeFileSync(file, content, 'utf8');
});
console.log('✅ Fixed Google Fonts across all perfectly!');
