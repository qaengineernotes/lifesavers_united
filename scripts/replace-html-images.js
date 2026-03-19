const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../');

// Function to recursively find all HTML and CSS files
const walkSync = (dir, filelist = []) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            // Ignore system folders and node_modules
            if (!['node_modules', '.git', '.firebase', '.gemini', 'scripts', 'imgs'].includes(file)) {
                filelist = walkSync(filePath, filelist);
            }
        } else {
            // Target HTML and CSS files
            if (filePath.endsWith('.html') || filePath.endsWith('.css')) {
                filelist.push(filePath);
            }
        }
    });
    return filelist;
};

// Function to perform the safe regex find-and-replace
const processFile = (filePath) => {
    const originalContent = fs.readFileSync(filePath, 'utf8');

    // 1. Regex to catch standard HTML tags: src="..." or href="..."
    let newContent = originalContent.replace(/(src|href)\s*=\s*(["'])(.+?)\.(png|jpg|jpeg)\2/gi, (match, attr, quote, imgPath, ext) => {
        const lowerPath = imgPath.toLowerCase();
        
        // Protection check: skip anything with "logo", "favicon", or app icons
        if (lowerPath.includes('logo') || lowerPath.includes('favicon') || lowerPath.includes('apple-icon') || lowerPath.includes('android-icon')) {
            return match; // Leave it exactly as it is
        }
        
        // Rewrite safely with .webp
        return `${attr}=${quote}${imgPath}.webp${quote}`;
    });

    // 2. Regex to catch CSS backgrounds: url('imgs/bg.jpg')
    newContent = newContent.replace(/(url\()(['"]?)(.+?)\.(png|jpg|jpeg)\2(\))/gi, (match, prefix, quote, imgPath, ext, suffix) => {
        const lowerPath = imgPath.toLowerCase();
        
        if (lowerPath.includes('logo') || lowerPath.includes('favicon') || lowerPath.includes('apple-icon') || lowerPath.includes('android-icon')) {
            return match;
        }
        
        return `${prefix}${quote}${imgPath}.webp${quote}${suffix}`;
    });

    // Only save the file if changes were actually made
    if (originalContent !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Updated HTML/CSS in: ${path.relative(rootDir, filePath)}`);
    }
};

console.log("\n🚀 Starting HTML Find & Replace for WebP...");
const files = walkSync(rootDir);

let filesChecked = files.length;
console.log(`Scanning ${filesChecked} files... \n`);

files.forEach(file => processFile(file));

console.log("\n🎉 Find & Replace complete! All references safely updated.\n");
