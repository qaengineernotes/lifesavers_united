const fs = require('fs');
const path = require('path');

// Get directory from command line
const customDir = process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]);

if (!customDir) {
    console.error('❌ Please provide a directory path.');
    console.log('Usage: node scripts/rename-images.js "C:\\Path\\To\\Images"');
    process.exit(1);
}

const targetDir = path.resolve(customDir);

if (!fs.existsSync(targetDir)) {
    console.error(`❌ Directory not found: ${targetDir}`);
    process.exit(1);
}

const renameFile = (oldPath) => {
    const ext = path.extname(oldPath);
    const basename = path.basename(oldPath, ext);
    
    // 1. Lowercase and trim
    let newBasename = basename.toLowerCase().trim();
    
    // 2. Add hyphen before trailing numbers if missing (e.g., "Manav Shah1" -> "manav shah-1")
    // This handles cases where there's no space before the number
    newBasename = newBasename.replace(/([a-z])(\d+)$/g, '$1-$2');
    
    // 3. Replace spaces and existing hyphens/underscores with a single hyphen
    newBasename = newBasename.replace(/[\s\-_]+/g, '-');
    
    // 4. Remove any leading/trailing hyphens just in case
    newBasename = newBasename.replace(/^-+|-+$/g, '');
    
    const newName = newBasename + ext.toLowerCase();
    const newPath = path.join(path.dirname(oldPath), newName);
    
    if (oldPath !== newPath) {
        try {
            // Check if destination already exists to avoid overwriting
            if (fs.existsSync(newPath)) {
                console.warn(`⚠️  Skipping: ${newName} already exists.`);
                return;
            }
            fs.renameSync(oldPath, newPath);
            console.log(`✅ Renamed: "${path.basename(oldPath)}" -> "${newName}"`);
        } catch (error) {
            console.error(`❌ Error renaming ${path.basename(oldPath)}:`, error.message);
        }
    }
};

const processDirectory = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else {
            // Only process image files (common extensions)
            if (['.webp', '.png', '.jpg', '.jpeg'].includes(path.extname(file).toLowerCase())) {
                renameFile(fullPath);
            }
        }
    });
};

console.log(`\n🚀 Starting renaming in ${targetDir}...\n`);
processDirectory(targetDir);
console.log(`\n✨ Finished processing.\n`);
