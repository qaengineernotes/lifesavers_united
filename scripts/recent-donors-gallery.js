/**
 * Recent Donors Gallery Loader for Index Page
 * Fetches and displays recent donation-related images from Google Drive
 */

document.addEventListener('DOMContentLoaded', async function () {
    const recentDonorsContainer = document.getElementById('recent-donors-gallery');
    const loadingIndicator = document.getElementById('recent-donors-loading');

    if (!recentDonorsContainer) {
        return; // Exit if container doesn't exist on this page
    }

    try {
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbyqSr5tm8V9tp4v1Jsq9LPzOQDIr51g2iMPOd2liWyi4VfpBZB01P19HoJ-zm5IRF0W/exec';

        // Fetch images from "Blood Donors" and "Donation Camps" categories
        const categories = ['Blood Donors', 'Donation Camps'];
        let allDonationImages = [];

        for (const category of categories) {
            const response = await fetch(`${scriptUrl}?category=${encodeURIComponent(category)}&t=${new Date().getTime()}`);

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    allDonationImages = allDonationImages.concat(data);
                }
            }
        }

        if (allDonationImages.length === 0) {
            // Hide loader
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            recentDonorsContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">No recent donor images available.</p>';
            return;
        }

        // Helper function to convert Google Drive URL to viewable format
        const convertDriveUrlToViewable = (url) => {
            if (!url) return '';

            // If URL is already in googleusercontent format, use it as-is
            if (url.includes('googleusercontent.com')) {
                return url;
            }

            // Extract file ID from various Google Drive URL formats
            let fileId = null;

            // Handle Google Drive uc?id= format
            if (url.includes('drive.google.com/uc') || url.includes('drive.google.com')) {
                const idMatch = url.match(/[?&]id=([^&]+)/);
                if (idMatch && idMatch[1]) {
                    fileId = idMatch[1];
                }
            }

            // Handle standard Google Drive file URLs
            if (!fileId) {
                const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                    fileId = fileIdMatch[1];
                }
            }

            // If we found a file ID, convert to viewable format
            if (fileId) {
                return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
            }

            return url;
        };

        // Process and sort images by date (newest first)
        const processedImages = allDonationImages.map((img) => ({
            id: img.id || Date.now() + Math.random(),
            src: convertDriveUrlToViewable(img.url || ''),
            category: img.category || 'Donation',
            title: img.name ? img.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Donor Image',
            date: img.date ? new Date(img.date) : new Date()
        }));

        // Sort by date (newest first) and take only the 4 most recent
        processedImages.sort((a, b) => b.date - a.date);
        const recentImages = processedImages.slice(0, 4);

        // Clear the container
        recentDonorsContainer.innerHTML = '';

        // Render each image
        recentImages.forEach((image) => {
            const imageCard = createImageCard(image);
            recentDonorsContainer.appendChild(imageCard);
        });

        // Hide loader after images are loaded
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading recent donor images:', error);
        // Hide loader on error
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        recentDonorsContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">Unable to load recent donor images.</p>';
    }
});

/**
 * Creates an image card element with gallery-style hover animation
 * @param {Object} image - Image data object
 * @returns {HTMLElement} Image card element
 */
function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'gallery-item';

    // Format the date
    const formattedDate = formatImageDate(image.date);

    card.innerHTML = `
        <img src="${image.src}" 
            alt="${image.title}" 
            class="gallery-item-image"
            loading="lazy"
            onerror="this.src='https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=800'; this.onerror=null;" />
        <div class="gallery-item-overlay">
            <div class="gallery-item-caption">
                <h3 class="font-bold text-lg mb-1">${image.title}</h3>
                <p class="text-sm opacity-90">${formattedDate}</p>
            </div>
        </div>
    `;

    // Add click event to open gallery page
    card.addEventListener('click', () => {
        window.location.href = '/gallery';
    });

    return card;
}

/**
 * Formats a date to a readable format
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date
 */
function formatImageDate(date) {
    if (!date) return 'Recently';

    // Compare calendar dates at midnight to avoid time-of-day skewing the result
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffMs = todayMidnight - dateMidnight;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }
}
