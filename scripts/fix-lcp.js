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

    // Make sure we haven't already added it to prevent duplicates
    if (!content.includes('href="/imgs/important-announcement.webp"')) {
        // Find the closing </head> tag and insert the preload line right above it
        const preloadTag = `\n    <!-- LCP Preload for Important Announcement Popup -->\n    <link rel="preload" as="image" href="/imgs/important-announcement.webp" fetchpriority="high">\n`;
        content = content.replace('</head>', `${preloadTag}</head>`);
        fs.writeFileSync(file, content, 'utf8');
    }
});
console.log('✅ Injected LCP Image Preload tags successfully!');
