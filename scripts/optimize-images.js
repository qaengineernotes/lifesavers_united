const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const chokidar = require('chokidar');

const imgsDir = path.join(__dirname, '../imgs');

const isWatchMode = process.argv.includes('--watch');

const convertToWebp = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        const webpPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.webp';

        if (fs.existsSync(webpPath)) {
            // Already compressed, skipping
            return;
        }

        try {
            console.log(`⏳ Converting: ${path.basename(filePath)}...`);
            await sharp(filePath)
                .webp({ quality: 80 }) // You can adjust quality here (0-100)
                .toFile(webpPath);
            console.log(`✅ Success: ${path.basename(webpPath)} created.`);
        } catch (error) {
            console.error(`❌ Error converting ${path.basename(filePath)}:`, error);
        }
    }
};

const processDirectory = (dir) => {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else {
            convertToWebp(fullPath);
        }
    });
};

if (isWatchMode) {
    console.log(`\n👀 Watching for new images in ${imgsDir}...\n`);

    // Process everything once just in case we missed some, then start watching
    processDirectory(imgsDir);

    chokidar.watch(imgsDir, {
        ignored: /(^|[\/\\])\../, // Ignore hidden files
        persistent: true,
        ignoreInitial: true // We already process the initial ones above
    })
        .on('add', filePath => convertToWebp(filePath))
        .on('change', filePath => convertToWebp(filePath));
} else {
    console.log(`\n🚀 Starting one-time image optimization in ${imgsDir}...\n`);
    processDirectory(imgsDir);
}
