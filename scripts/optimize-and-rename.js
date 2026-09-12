const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Parse CLI Arguments
// Usage: node scripts/optimize-and-rename.js "<input_folder>" "<base_name>" [optional_output_folder]
const args = process.argv.slice(2);

let inputDir = null;
let baseName = null;
let outputDir = null;
let maxWidth = 1920;
let quality = 80;

// Filter out flag arguments
const positionalArgs = [];
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-width' && args[i + 1]) {
        maxWidth = parseInt(args[++i], 10);
    } else if (arg === '--quality' && args[i + 1]) {
        quality = parseInt(args[++i], 10);
    } else if (arg === '--output' && args[i + 1]) {
        outputDir = path.resolve(args[++i]);
    } else if (!arg.startsWith('--')) {
        positionalArgs.push(arg);
    }
}

if (positionalArgs.length >= 1) {
    inputDir = path.resolve(positionalArgs[0]);
}
if (positionalArgs.length >= 2) {
    baseName = positionalArgs[1];
}
if (positionalArgs.length >= 3 && !outputDir) {
    outputDir = path.resolve(positionalArgs[2]);
}

if (!inputDir || !baseName) {
    console.error('❌ Missing required parameters.');
    console.log('\nUsage:');
    console.log('  node scripts/optimize-and-rename.js "<folder_path>" "<base_name>" [output_folder]');
    console.log('\nExamples:');
    console.log('  node scripts/optimize-and-rename.js "D:\\Photos" "blood-donation-camp-at-sahay-with-help-volunteer-blood-center"');
    console.log('  node scripts/optimize-and-rename.js "D:\\Photos" "blood-donation-camp-at-sahay-with-help-volunteer-blood-center" "./imgs"');
    process.exit(1);
}

// Default outputDir to imgs/ in the project root if not specified
if (!outputDir) {
    outputDir = path.join(__dirname, '../imgs');
}

if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input folder not found: ${inputDir}`);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Clean up baseName: remove trailing dashes, numbers, or extensions if provided by mistake
let cleanBase = baseName.trim().replace(/\.[^/.]+$/, '').replace(/[-_\s]+$/, '');

// Format file size nicely
const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

async function run() {
    console.log('====================================================');
    console.log('🖼️   Image Optimizer & Batch Renamer to .webp');
    console.log('====================================================');
    console.log(`📁 Source Folder: ${inputDir}`);
    console.log(`🎯 Base Name:     ${cleanBase}`);
    console.log(`💾 Output Folder: ${outputDir}`);
    console.log(`⚙️  Settings:      Max Width: ${maxWidth}px | Quality: ${quality}% WebP`);
    console.log('----------------------------------------------------\n');

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.avif'];

    // Read and filter input files
    const allFiles = fs.readdirSync(inputDir);
    const imageFiles = allFiles
        .filter(f => validExtensions.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (imageFiles.length === 0) {
        console.warn(`⚠️  No image files found in ${inputDir}`);
        return;
    }

    console.log(`🔍 Found ${imageFiles.length} images to process...\n`);

    let processedCount = 0;
    let totalOriginalBytes = 0;
    let totalOptimizedBytes = 0;
    const outputRelativePaths = [];

    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const sourcePath = path.join(inputDir, file);
        const index = i + 1;
        const targetFilename = `${cleanBase}-${index}.webp`;
        const targetPath = path.join(outputDir, targetFilename);

        try {
            const originalStats = fs.statSync(sourcePath);
            totalOriginalBytes += originalStats.size;

            process.stdout.write(`⏳ [${index}/${imageFiles.length}] Processing: ${file} ... `);

            // Read image metadata to handle dimensions & auto-rotation
            const imagePipeline = sharp(sourcePath).rotate(); // auto-rotate based on EXIF

            const metadata = await imagePipeline.metadata();

            if (metadata.width && metadata.width > maxWidth) {
                imagePipeline.resize({ width: maxWidth, withoutEnlargement: true });
            }

            await imagePipeline
                .webp({ quality: quality, effort: 4 })
                .toFile(targetPath);

            const newStats = fs.statSync(targetPath);
            totalOptimizedBytes += newStats.size;

            const reduction = (((originalStats.size - newStats.size) / originalStats.size) * 100).toFixed(1);
            console.log(`✅ ${targetFilename} (${formatSize(originalStats.size)} ➔ ${formatSize(newStats.size)}, -${reduction}%)`);

            outputRelativePaths.push(`imgs/${targetFilename}`);
            processedCount++;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
        }
    }

    console.log('\n====================================================');
    console.log(`🎉 Optimization Complete!`);
    console.log(`✨ Total Processed: ${processedCount} of ${imageFiles.length} files`);
    console.log(`📉 Total Size:      ${formatSize(totalOriginalBytes)} ➔ ${formatSize(totalOptimizedBytes)}`);
    if (totalOriginalBytes > 0) {
        const overallSavings = (((totalOriginalBytes - totalOptimizedBytes) / totalOriginalBytes) * 100).toFixed(1);
        console.log(`⚡ Overall Saved:   ${formatSize(totalOriginalBytes - totalOptimizedBytes)} (${overallSavings}% reduction)`);
    }
    console.log('====================================================\n');

    console.log('📋 Relative paths ready for data/events.json:');
    console.log(JSON.stringify(outputRelativePaths, null, 2));
}

run().catch(err => {
    console.error('Fatal error during optimization:', err);
    process.exit(1);
});
