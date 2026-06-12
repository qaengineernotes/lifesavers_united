const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../lifesavers-united-org-firebase-adminsdk-fbsvc-8c58d66d9e.json');
const bucketName = 'lifesavers-united-org.firebasestorage.app';

if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Firebase Service Account JSON not found at: ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName
});

const bucket = admin.storage().bucket();

// Folder mapping matching client-side JS
const folderToCategoryMap = {
    'blood-donors': 'Blood Donors',
    'donation-camps': 'Donation Camps',
    'events': 'Events',
    'awards': 'Awards & Recognition'
};

// Date formatter matching client-side
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Smart Title Cleaning Logic matching client-side
function cleanTitle(fileName) {
    let cleanName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    
    // 1. Identify and protect dates (e.g., 22-02-2026)
    const datePattern = /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/;
    const dateMatch = cleanName.match(datePattern);
    const foundDate = dateMatch ? dateMatch[0] : null;
    
    // 2. Temporarily remove the date to clean the rest of the string
    if (foundDate) {
        cleanName = cleanName.replace(foundDate, '||DATE||');
    }
    
    // 3. Remove trailing duplicate numbers (e.g., -1, -2)
    cleanName = cleanName.replace(/-\d+$/, '');
    
    // 4. Replace hyphens with spaces and convert to Title Case
    cleanName = cleanName.replace(/[-_]/g, ' ')
                         .split(' ')
                         .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                         .join(' ');
    
    // 5. Put the date back if it existed
    if (foundDate) {
        cleanName = cleanName.replace('||date||', foundDate).replace('||Date||', foundDate);
    }
    
    return cleanName;
}

async function run() {
    console.log('⏳ Connecting to Firebase Storage...');
    try {
        // Fetch files with the prefix 'gallery/'
        const [files] = await bucket.getFiles({ prefix: 'gallery/' });
        
        console.log(`✅ Connected successfully. Found ${files.length} total objects under 'gallery/' prefix.`);
        
        const galleryItems = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

        for (const file of files) {
            const ext = path.extname(file.name).toLowerCase();
            // Filter only image files and ignore directory placeholders (paths ending with '/')
            if (!file.name.endsWith('/') && imageExtensions.includes(ext)) {
                const parts = file.name.split('/');
                // Example name: gallery/events/camp-2026.jpg
                // parts = ['gallery', 'events', 'camp-2026.jpg']
                
                // Only include if it resides in a subdirectory of 'gallery'
                if (parts.length >= 3) {
                    const subfolder = parts[1];
                    const filename = parts[2];
                    
                    const category = folderToCategoryMap[subfolder] || 
                        subfolder.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    const encodedPath = encodeURIComponent(file.name);
                    const srcUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
                    
                    // Retrieve metadata
                    const [metadata] = await file.getMetadata();
                    const customMeta = metadata.metadata || {};
                    const date = customMeta.sortDate || metadata.timeCreated || new Date().toISOString();
                    
                    const title = cleanTitle(filename);
                    
                    galleryItems.push({
                        id: file.name,
                        src: srcUrl,
                        category: category,
                        title: title,
                        date: date
                    });
                }
            }
        }

        console.log(`🎨 Found ${galleryItems.length} valid gallery images.`);
        
        if (galleryItems.length === 0) {
            console.log('⚠️ No images found. Skipping update.');
            return;
        }

        // Sort by date (newest first)
        galleryItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 2. Update gallery.html
        const galleryHtmlPath = path.join(__dirname, '../gallery.html');
        if (fs.existsSync(galleryHtmlPath)) {
            console.log(`📝 Updating noscript grid in gallery.html...`);
            let htmlContent = fs.readFileSync(galleryHtmlPath, 'utf8');

            const noscriptImagesHtml = galleryItems.map((item, index) => {
                let altText = item.title;
                if (!altText.toLowerCase().includes('lifesavers united')) {
                    altText = `${altText} - LifeSavers United`;
                }

                return `                <div class="gallery-item relative group" data-id="${item.id}" data-category="${item.category}">
                    <img src="${item.src}" 
                         alt="${altText}" 
                         class="gallery-item-image w-full h-full object-cover"
                         loading="lazy"
                         data-item-index="${index}">
                    <div class="gallery-item-overlay">
                        <div class="gallery-item-caption">
                            <h3 class="font-bold text-lg mb-1">${item.title}</h3>
                            <p class="text-sm opacity-90">${formatDate(item.date)}</p>
                        </div>
                    </div>
                </div>`;
            }).join('\n');

            const fullNoscriptBlock = `<!-- START_NOSCRIPT_IMAGES -->
                <noscript>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
${noscriptImagesHtml}
                    </div>
                </noscript>
                <!-- END_NOSCRIPT_IMAGES -->`;

            const noscriptRegex = /<!-- START_NOSCRIPT_IMAGES -->[\s\S]*?<!-- END_NOSCRIPT_IMAGES -->/;
            if (noscriptRegex.test(htmlContent)) {
                htmlContent = htmlContent.replace(noscriptRegex, fullNoscriptBlock);
                fs.writeFileSync(galleryHtmlPath, htmlContent, 'utf8');
                console.log(`✅ gallery.html updated successfully.`);
            } else {
                console.error(`❌ Could not find <!-- START_NOSCRIPT_IMAGES --> markers in gallery.html.`);
            }
        } else {
            console.error(`❌ gallery.html not found at: ${galleryHtmlPath}`);
        }

        // 3. Update sitemap.xml
        const sitemapXmlPath = path.join(__dirname, '../sitemap.xml');
        if (fs.existsSync(sitemapXmlPath)) {
            console.log(`📝 Updating image listings in sitemap.xml...`);
            let xmlContent = fs.readFileSync(sitemapXmlPath, 'utf8');

            // Format date for sitemap's lastmod element (YYYY-MM-DD)
            const todayStr = new Date().toISOString().split('T')[0];

            const sitemapImagesXml = galleryItems.map(item => {
                // Escape XML entities
                const escapedUrl = item.src.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                let sitemapTitle = item.title;
                if (!sitemapTitle.toLowerCase().includes('lifesavers united')) {
                    sitemapTitle = `${sitemapTitle} - LifeSavers United`;
                }
                const escapedTitle = sitemapTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                let sitemapCaption = `${item.title} - ${item.category}`;
                if (!sitemapCaption.toLowerCase().includes('lifesavers united')) {
                    sitemapCaption = `${sitemapCaption} - LifeSavers United`;
                }
                const escapedCaption = sitemapCaption.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                return `        <image:image>
            <image:loc>${escapedUrl}</image:loc>
            <image:title>${escapedTitle}</image:title>
            <image:caption>${escapedCaption}</image:caption>
        </image:image>`;
            }).join('\n');

            const fullSitemapBlock = `<!-- START_GALLERY_IMAGES -->
${sitemapImagesXml}
        <!-- END_GALLERY_IMAGES -->`;

            const sitemapRegex = /<!-- START_GALLERY_IMAGES -->[\s\S]*?<!-- END_GALLERY_IMAGES -->/;
            if (sitemapRegex.test(xmlContent)) {
                xmlContent = xmlContent.replace(sitemapRegex, fullSitemapBlock);
                
                // Also update <lastmod> for the gallery url entry
                const galleryUrlBlockRegex = /(<loc>https:\/\/lifesaversunited\.org\/gallery<\/loc>\s*<lastmod>).*?(<\/lastmod>)/;
                if (galleryUrlBlockRegex.test(xmlContent)) {
                    xmlContent = xmlContent.replace(galleryUrlBlockRegex, `$1${todayStr}$2`);
                }
                
                fs.writeFileSync(sitemapXmlPath, xmlContent, 'utf8');
                console.log(`✅ sitemap.xml updated successfully.`);
            } else {
                console.error(`❌ Could not find <!-- START_GALLERY_IMAGES --> markers in sitemap.xml.`);
            }
        } else {
            console.error(`❌ sitemap.xml not found at: ${sitemapXmlPath}`);
        }

        console.log('🎉 Update execution completed successfully.');
    } catch (error) {
        console.error('❌ Error executing gallery SEO update:', error);
        process.exit(1);
    }
}

run();
