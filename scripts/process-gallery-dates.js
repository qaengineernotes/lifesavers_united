const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const ExifParser = require('exif-parser');
const path = require('path');

// 1. Initialize Firebase Admin
// Using the service account key found in the root
const serviceAccount = require('../lifesavers-united-org-firebase-adminsdk-fbsvc-8c58d66d9e.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'lifesavers-united-org.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../lifesavers-united-org-firebase-adminsdk-fbsvc-8c58d66d9e.json')
});

/**
 * Helper: Extract dates from text using regex
 * Supports: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, and "D Month YYYY"
 */
function extractDatesFromText(text) {
  if (!text) return [];
  const dates = [];

  // 1. Numeric patterns (DD-MM-YYYY, YYYY-MM-DD)
  const numericRegex = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})|(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
  const numericMatches = [...text.matchAll(numericRegex)];
  for (const match of numericMatches) {
    try {
      let dateStr = match[1] ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : `${match[4]}-${match[5].padStart(2, '0')}-${match[6].padStart(2, '0')}`;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) dates.push(d);
    } catch (e) {}
  }

  // 2. Month name patterns (e.g., "5 May 2026", "May 5, 2026")
  const monthNames = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const textDateRegex = new RegExp(`(\\d{1,2})\\s+${monthNames}\\s*,?\\s*(\\d{4})|${monthNames}\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})`, "gi");
  
  const textMatches = [...text.matchAll(textDateRegex)];
  for (const match of textMatches) {
    try {
      // Handle both "5 May 2026" and "May 5 2026"
      const dateStr = match[1] ? `${match[1]} ${match[2]} ${match[3]}` : `${match[4]} ${match[5]} ${match[6]}`;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) dates.push(d);
    } catch (e) {}
  }

  return dates;
}

async function processGallery() {
  console.log("🚀 Starting Gallery Intelligence Processing...");

  // List all files in the gallery folder
  const [files] = await bucket.getFiles({ prefix: 'gallery/' });
  console.log(`Found ${files.length} files in the gallery.`);

  const results = [];
  let globalOldestDate = new Date(); 

  // PASS 1: Extract dates from all images
  for (const file of files) {
    if (file.name.endsWith('/') || !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) continue;

    console.log(`\n🔍 Analyzing: ${file.name}`);
    let bestDate = null;

    try {
      const [buffer] = await file.download();

      // --- A. TRY OCR (Priority 1) ---
      const [visionResult] = await visionClient.textDetection(buffer);
      const text = visionResult.fullTextAnnotation ? visionResult.fullTextAnnotation.text : '';
      
      // DEBUG: Show a snippet of what OCR found
      if (text) {
        console.log(`   📝 OCR Text snippet: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
      }

      const ocrDates = extractDatesFromText(text);
      
      if (ocrDates.length > 0) {
        // Use the first OCR date found
        bestDate = ocrDates[0];
        console.log(`   ✅ Found OCR Date: ${bestDate.toISOString().split('T')[0]}`);
      }

      // --- B. TRY EXIF (Priority 2 - only if OCR fails) ---
      if (!bestDate) {
        try {
          const parser = ExifParser.create(buffer);
          const exifResult = parser.parse();
          if (exifResult.tags && exifResult.tags.DateTimeOriginal) {
            bestDate = new Date(exifResult.tags.DateTimeOriginal * 1000);
            console.log(`   ✅ Found EXIF Date: ${bestDate.toISOString().split('T')[0]}`);
          }
        } catch (exifErr) {
          // EXIF parsing often fails for WebP/PNG
        }
      }

      if (bestDate) {
        results.push({ file, date: bestDate });
        if (bestDate < globalOldestDate) globalOldestDate = bestDate;
      } else {
        results.push({ file, date: null });
        console.log(`   ⚠️ No date detected.`);
      }

    } catch (err) {
      console.error(`   ❌ Error processing ${file.name}:`, err.message);
    }
  }

  console.log(`\n✨ Scan Complete. Global Oldest Date: ${globalOldestDate.toISOString().split('T')[0]}`);

  // PASS 2: Update Metadata in Storage
  console.log("\n💾 Saving Metadata to Firebase...");
  for (const item of results) {
    // If no date was found, use the global oldest date as per requirement
    const finalDate = item.date || globalOldestDate;
    const dateStr = finalDate.toISOString();

    try {
      await item.file.setMetadata({
        metadata: {
          sortDate: dateStr,
          dateSource: item.date ? 'extracted' : 'global-fallback'
        }
      });
      console.log(`   Updated ${item.file.name} -> ${dateStr.split('T')[0]}`);
    } catch (err) {
      console.error(`   Failed to update ${item.file.name}:`, err.message);
    }
  }

  console.log("\n✅ Done! All images are now tagged with a 'sortDate' for perfect sorting.");
}

processGallery().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
