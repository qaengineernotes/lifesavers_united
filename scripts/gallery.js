// Hide loading indicator function
function hideLoadingIndicator() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Global variable to store gallery data
    let galleryData = [];

    // Function to show error message
    const showError = (message) => {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded col-span-full';
        errorDiv.role = 'alert';
        errorDiv.innerHTML = `
                    <p class="font-bold">Error Loading Gallery</p>
                    <p>${message}</p>
                    <p class="text-sm mt-2">Please check:</p>
                    <ul class="text-sm list-disc ml-5">
                        <li>Google Drive folder is shared publicly</li>
                        <li>All images have public view access</li>
                        <li>Google Apps Script is deployed correctly</li>
                    </ul>
                `;

        const galleryGrid = document.getElementById('gallery-grid');
        if (galleryGrid) {
            galleryGrid.innerHTML = '';
            galleryGrid.appendChild(errorDiv);
        }

        hideLoadingIndicator();
    };

    // Function to load gallery data from Google Apps Script
    const loadGalleryData = async () => {
        try {
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbzQFclRK_YZ9lzxYNkT1Y4wQBNNaqoZk6oTiZCQHu9_uTIbS9a0175wz6vkjsYhB69X1A/exec';

            const response = await fetch(`${scriptUrl}?t=${new Date().getTime()}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`Invalid JSON response`);
            }

            if (data && data.error) {
                throw new Error(`Script error: ${data.error}`);
            }

            if (!Array.isArray(data)) {
                throw new Error(`Expected array but got: ${typeof data}`);
            }

            // Helper function to convert Google Drive download URL to viewable URL
            const convertDriveUrlToViewable = (url) => {
                if (!url) return '';

                // If URL is already in googleusercontent format, use it as-is (best format)
                if (url.includes('googleusercontent.com')) {
                    return url;
                }

                // Extract file ID from various Google Drive URL formats
                let fileId = null;

                // Handle Google Drive uc?id= format with export=download
                if (url.includes('drive.google.com/uc') || url.includes('drive.google.com')) {
                    const idMatch = url.match(/[?&]id=([^&]+)/);
                    if (idMatch && idMatch[1]) {
                        fileId = idMatch[1];
                    }
                }

                // Handle standard Google Drive file URLs
                // Example: https://drive.google.com/file/d/FILE_ID/view
                if (!fileId) {
                    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (fileIdMatch && fileIdMatch[1]) {
                        fileId = fileIdMatch[1];
                    }
                }

                // If we found a file ID, convert to viewable format
                if (fileId) {
                    // ALWAYS use googleusercontent format for img tags - no CORS issues
                    // This format works reliably when files are publicly shared
                    // w1200 = width 1200px (adjust as needed: w400, w800, w1200, w1920)
                    return `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
                }

                // If URL is already in viewable format, return as is
                return url;
            };

            // Process images to match gallery format
            galleryData = data.map((img) => ({
                id: img.id || Date.now() + Math.random(),
                src: convertDriveUrlToViewable(img.url || ''),
                category: img.category || 'gallery',
                title: img.name ? img.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Gallery Image',
                date: img.date ? new Date(img.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }));

            if (galleryData.length === 0) {
                showError('No images found in the gallery. Please upload some images to your Google Drive folder.');
                return;
            }

            // Sort by date (newest first)
            galleryData.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Initialize the gallery with the fetched data
            initGallery();
            hideLoadingIndicator();
        } catch (error) {
            showError(`Failed to load gallery: ${error.message}`);
            galleryData = [];
            hideLoadingIndicator();
        }
    };

    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 9;
    let currentFilter = 'all';

    // DOM elements
    const galleryGrid = document.getElementById('gallery-grid');
    const paginationContainer = document.getElementById('pagination');
    const filterButtons = document.querySelectorAll('[data-filter]');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closeButton = document.querySelector('.lightbox-close');
    const prevButton = document.getElementById('prev-btn');
    const nextButton = document.getElementById('next-btn');

    let currentImageIndex = 0;
    let filteredGallery = [];
    let paginatedGallery = [];

    // Initialize the gallery
    function initGallery() {

         // Add image error handler
        window.handleImageError = function (img) {
            const fallbacks = JSON.parse(img.getAttribute('data-fallbacks') || '[]');
            const currentUrl = img.src;

            // Get or initialize tried URLs - only include current failed URL
            let triedUrls = [];
            const triedUrlsAttr = img.getAttribute('data-tried-urls');
            if (triedUrlsAttr) {
                triedUrls = JSON.parse(triedUrlsAttr);
            }

            // Add current URL to tried list if not already there
            if (!triedUrls.includes(currentUrl)) {
                triedUrls.push(currentUrl);
            }

            // Try next fallback URL
            for (const fallbackUrl of fallbacks) {
                if (!triedUrls.includes(fallbackUrl)) {
                    triedUrls.push(fallbackUrl);
                    img.setAttribute('data-tried-urls', JSON.stringify(triedUrls));
                    img.src = fallbackUrl;
                    return;
                }
            }

            // If all URLs failed, show error message
            img.parentElement.innerHTML = '<div class="flex items-center justify-center h-full bg-gray-200 text-gray-500">Image not available</div>';
        };

        filterGallery();
        renderGallery();
        renderPagination();
        setupEventListeners();
    }

    // Filter gallery based on category
    function filterGallery() {
        if (currentFilter === 'all') {
            filteredGallery = [...galleryData];
        } else {
            filteredGallery = galleryData.filter(item => item.category === currentFilter);
        }
        currentPage = 1;
        updatePaginatedGallery();
    }

    // Update paginated gallery based on current page
    function updatePaginatedGallery() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        paginatedGallery = filteredGallery.slice(startIndex, endIndex);
    }

    // Render gallery items
    function renderGallery() {
        // Hide loading state when rendering
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        if (filteredGallery.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">No images found in this category.</div>';
            return;
        }

        galleryGrid.innerHTML = paginatedGallery.map((item, index) => {
            // Extract file ID for fallback URLs from various formats
            let fileId = null;

            // Try to extract from googleusercontent URL: lh3.googleusercontent.com/d/FILE_ID=w1200
            const googleUserMatch = item.src.match(/googleusercontent\.com\/d\/([^=]+)/);
            if (googleUserMatch) {
                fileId = googleUserMatch[1];
            }

            // Try to extract from drive.google.com URL: drive.google.com/uc?id=FILE_ID
            if (!fileId) {
                const driveMatch = item.src.match(/[?&]id=([^&]+)/);
                if (driveMatch) {
                    fileId = driveMatch[1];
                }
            }

            // Create fallback URLs (prioritize googleusercontent format)
            const fallbackUrls = [];
            if (fileId) {
                // Always try googleusercontent formats first (no CORS issues)
                if (!item.src.includes('googleusercontent.com')) {
                    // Primary URL is not googleusercontent, add it as first fallback
                    fallbackUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w1200`);
                }
                // Try different sizes of googleusercontent
                fallbackUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w800`);
                fallbackUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w1920`);
                // Last resort: try uc?id= format (might have CORS issues)
                fallbackUrls.push(`https://drive.google.com/uc?id=${fileId}`);
            }

            return `
                        <div class="gallery-item relative group" data-id="${item.id}" data-category="${item.category}">
                            <img src="${item.src}" 
                                 alt="${item.title}" 
                                 class="w-full h-full object-cover"
                                 loading="lazy"
                                 data-primary-url="${item.src}"
                                 data-fallbacks='${JSON.stringify(fallbackUrls)}'
                                data-item-index="${index}"
                                onerror="handleImageError(this)">
                            <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <div class="text-white text-center p-4">
                                    <h3 class="font-bold text-lg mb-1">${item.title}</h3>
                                    <p class="text-sm">${formatDate(item.date)}</p>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('');

       

        // Add click event to gallery items
        document.querySelectorAll('.gallery-item').forEach((item, index) => {
            item.addEventListener('click', () => openLightbox(index));
        });
    }

    // Render pagination
    function renderPagination() {
        const totalPages = Math.ceil(filteredGallery.length / itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = `
                    <button class="pagination-prev" 
                            ${currentPage === 1 ? 'disabled' : ''}
                            aria-label="Previous page">
                        «
                    </button>
                `;

        // Smart pagination with ellipsis
        const showPages = 5; // Number of page buttons to show around current page
        let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
        let endPage = Math.min(totalPages, startPage + showPages - 1);

        // Adjust start page if we're near the end
        if (endPage - startPage < showPages - 1) {
            startPage = Math.max(1, endPage - showPages + 1);
        }

        // Show first page and ellipsis if needed
        if (startPage > 1) {
            paginationHTML += `
                        <button class="pagination-page" data-page="1">1</button>
                    `;
            if (startPage > 2) {
                paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
            }
        }

        // Show page numbers
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                        <button class="pagination-page ${i === currentPage ? 'active' : ''}" data-page="${i}">
                            ${i}
                        </button>
                    `;
        }

        // Show last page and ellipsis if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
            }
            const lastPageActive = currentPage === totalPages ? 'active' : '';
            paginationHTML += `
                        <button class="pagination-page ${lastPageActive}" data-page="${totalPages}">${totalPages}</button>
                    `;
        }

        // Update first page if it's active and shown separately
        if (startPage > 1 && currentPage === 1) {
            paginationHTML = paginationHTML.replace(
                '<button class="pagination-page" data-page="1">1</button>',
                '<button class="pagination-page active" data-page="1">1</button>'
            );
        }

        paginationHTML += `
                    <button class="pagination-next" 
                            ${currentPage === totalPages ? 'disabled' : ''}
                            aria-label="Next page">
                        »
                    </button>
                `;

        paginationContainer.innerHTML = paginationHTML;

        const prevBtn = document.querySelector('.pagination-prev');
        const nextBtn = document.querySelector('.pagination-next');
        const pageBtns = document.querySelectorAll('.pagination-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    updatePaginatedGallery();
                    renderGallery();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    updatePaginatedGallery();
                    renderGallery();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        pageBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                updatePaginatedGallery();
                renderGallery();
                renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });

            });
        });
    }

    // Format date as DD/MM/YYYY
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    // Open lightbox with the clicked image
    function openLightbox(index) {
        currentImageIndex = (currentPage - 1) * itemsPerPage + index;
        updateLightbox();
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Update lightbox content
    function updateLightbox() {
        const item = filteredGallery[currentImageIndex];
        if (!item) return;

        lightboxImage.src = item.src;
        lightboxImage.alt = item.title;
        lightboxCaption.textContent = item.title + ' - ' + formatDate(item.date);
    }

    // Close lightbox
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Navigate to previous image
    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updateLightbox();
        }
    }

    // Navigate to next image
    function nextImage() {
        if (currentImageIndex < filteredGallery.length - 1) {
            currentImageIndex++;
            updateLightbox();
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active filter button
                filterButtons.forEach(btn => {
                    btn.classList.remove('bg-primary', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-700');
                });

                button.classList.remove('bg-gray-200', 'text-gray-700');
                button.classList.add('bg-primary', 'text-white');

                currentFilter = button.dataset.filter;
                filterGallery();
                renderGallery();
                renderPagination();
            });
        });

        // Lightbox navigation
        if (closeButton) closeButton.addEventListener('click', closeLightbox);
        if (prevButton) prevButton.addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });
        if (nextButton) nextButton.addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display === 'flex') {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') prevImage();
                if (e.key === 'ArrowRight') nextImage();
            }
        });

        // Close lightbox when clicking outside the image
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }

    // Load gallery data when the page loads
    loadGalleryData();

    // Timeout fallback
    setTimeout(() => {
        const loadingState = document.getElementById('loadingState');
        if (loadingState && !loadingState.classList.contains('hidden')) {
            hideLoadingIndicator();
            showError('Loading timed out. Please refresh the page.');
        }
    }, 15000);
});