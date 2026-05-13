/**
 * Recent Donors Gallery Loader for Index Page
 * Fetches and displays the 4 latest donor images from Firebase Storage
 */

import { storage, ref, listAll, getDownloadURL, getMetadata } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async function () {
    const recentDonorsContainer = document.getElementById('recent-donors-gallery');
    const loadingIndicator = document.getElementById('recent-donors-loading');

    if (!recentDonorsContainer) return;

    // Smart Title Cleaning Logic (Same as main gallery)
    function cleanImageTitle(filename) {
        let cleanName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
        
        // 1. Identify and protect dates
        const datePattern = /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/;
        const dateMatch = cleanName.match(datePattern);
        const foundDate = dateMatch ? dateMatch[0] : null;
        
        if (foundDate) cleanName = cleanName.replace(foundDate, '||DATE||');
        
        // 2. Remove trailing duplicate numbers
        cleanName = cleanName.replace(/-\d+$/, '');
        
        // 3. Title Case
        cleanName = cleanName.replace(/[-_]/g, ' ')
                             .split(' ')
                             .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                             .join(' ');
        
        if (foundDate) cleanName = cleanName.replace('||date||', foundDate).replace('||Date||', foundDate);
        return cleanName;
    }

    // Helper to fetch images from a folder
    const fetchImagesFromFolder = async (folderPath) => {
        try {
            const folderRef = ref(storage, folderPath);
            const result = await listAll(folderRef);
            
            const imagePromises = result.items.map(async (itemRef) => {
                try {
                    const [url, metadata] = await Promise.all([
                        getDownloadURL(itemRef),
                        getMetadata(itemRef).catch(() => ({}))
                    ]);
                    
                    return {
                        id: itemRef.fullPath,
                        src: url,
                        title: cleanImageTitle(itemRef.name),
                        date: metadata.customMetadata?.sortDate || metadata.timeCreated || new Date().toISOString()
                    };
                } catch (err) {
                    console.warn(`Failed to load ${itemRef.fullPath}:`, err);
                    return null;
                }
            });

            return (await Promise.all(imagePromises)).filter(img => img !== null);
        } catch (error) {
            console.error(`Error fetching ${folderPath}:`, error);
            return [];
        }
    };

    try {
        // Fetch from both relevant folders
        const [donorImages, campImages] = await Promise.all([
            fetchImagesFromFolder('gallery/blood-donors'),
            fetchImagesFromFolder('gallery/donation-camps')
        ]);

        let allImages = [...donorImages, ...campImages];

        if (allImages.length === 0) {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            recentDonorsContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">No recent donor images available.</p>';
            return;
        }

        // Sort by date (newest first) and take the latest 4
        allImages.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentImages = allImages.slice(0, 4);

        // Clear and Render
        recentDonorsContainer.innerHTML = '';
        recentImages.forEach((image) => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            card.innerHTML = `
                <img src="${image.src}" 
                    alt="${image.title}" 
                    class="gallery-item-image"
                    loading="lazy"
                    onerror="this.src='https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=800'; this.onerror=null;" />
                <div class="gallery-item-overlay">
                    <div class="gallery-item-caption">
                        <h3 class="font-bold text-lg mb-1">${image.title}</h3>
                        <p class="text-sm opacity-90">${formatImageDate(new Date(image.date))}</p>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => { window.location.href = '/gallery'; });
            recentDonorsContainer.appendChild(card);
        });

        if (loadingIndicator) loadingIndicator.style.display = 'none';

    } catch (error) {
        console.error('Error loading recent donors:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        recentDonorsContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">Unable to load recent donor images.</p>';
    }
});

function formatImageDate(date) {
    if (!date) return 'Recently';
    const now = new Date();
    const diffDays = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}
