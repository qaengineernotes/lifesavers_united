const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../');

const walkSync = (dir, filelist = []) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!['node_modules', '.git', '.firebase', '.gemini', 'scripts', 'imgs', 'css'].includes(file)) {
                filelist = walkSync(filePath, filelist);
            }
        } else {
            if (filePath.endsWith('.html')) {
                filelist.push(filePath);
            }
        }
    });
    return filelist;
};

const processFile = (filePath) => {
    const originalContent = fs.readFileSync(filePath, 'utf8');

    // Regex to catch exact Google font links, adjusting for newlines between attributes
    const fontRegex = /<link[\s\n]+rel=["']stylesheet["'][\s\n]+href=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["'][^>]*>/gi;

    let newContent = originalContent.replace(fontRegex, (match, url) => {
        return `<link rel="preload" as="style" href="${url}" />\n    <link rel="stylesheet" href="${url}" media="print" onload="this.media='all'" />\n    <noscript><link rel="stylesheet" href="${url}" /></noscript>`;
    });

    // We keep css/main.css as standard rel="stylesheet" because deferring it causes a "Flash of Unstyled Content" (FOUC)
    // But we will add a preload tag above it to ensure the browser downloads it instantly
    const mainCssRegex = /<link\s+rel=["']stylesheet["']\s+href=["']css\/main\.css["']>/gi;
    if (!newContent.includes('rel="preload" as="style" href="css/main.css"')) {
        newContent = newContent.replace(mainCssRegex, `<link rel="preload" as="style" href="css/main.css">\n    <link rel="stylesheet" href="css/main.css">`);
    }

    if (originalContent !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Fixed render-blocking in: ${path.relative(rootDir, filePath)}`);
    }
};

console.log("\n🚀 Starting to fix render-blocking fonts and CSS...");
const files = walkSync(rootDir);

let filesChecked = files.length;
console.log(`Scanning ${filesChecked} HTML files... \n`);

let updatedCount = 0;
files.forEach(file => {
    const originalContent = fs.readFileSync(file, 'utf8');
    processFile(file);
    if(originalContent !== fs.readFileSync(file, 'utf8')) updatedCount++;
});

console.log(`\n🎉 Complete! Fixed ${updatedCount} files to load fonts efficiently.\n`);
