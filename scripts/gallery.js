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
    // Function to show error message
    const showError = (message, isEmptyCategory = false) => {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        const errorDiv = document.createElement('div');

        if (isEmptyCategory) {
            // Friendly message for empty categories
            errorDiv.className = 'bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-6 rounded col-span-full text-center';
            errorDiv.innerHTML = `
            <div class="flex flex-col items-center">
                <svg class="w-16 h-16 mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="font-bold text-xl mb-2">No Images Yet</p>
                <p class="text-blue-600">${message}</p>
            </div>
        `;
        } else {
            // Error message for actual errors
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
        }

        const galleryGrid = document.getElementById('gallery-grid');
        if (galleryGrid) {
            galleryGrid.innerHTML = '';
            galleryGrid.appendChild(errorDiv);
        }

        hideLoadingIndicator();
    };

    // Function to load gallery data from Google Apps Script
    const loadGalleryData = async (category = 'ALL') => {
        try {
            // Show loading indicator (external heartbeat loader)
            const loadingState = document.getElementById('loadingState');
            if (loadingState) {
                loadingState.classList.remove('hidden');
            }

            // Clear gallery grid
            const galleryGrid = document.getElementById('gallery-grid');
            if (galleryGrid) {
                galleryGrid.innerHTML = '';
            }

            const scriptUrl = 'https://script.google.com/macros/s/AKfycbyqSr5tm8V9tp4v1Jsq9LPzOQDIr51g2iMPOd2liWyi4VfpBZB01P19HoJ-zm5IRF0W/exec';

            const response = await fetch(`${scriptUrl}?category=${encodeURIComponent(category)}&t=${new Date().getTime()}`);

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

            // Process images
            galleryData = data.map((img) => ({
                id: img.id || Date.now() + Math.random(),
                src: convertDriveUrlToViewable(img.url || ''),
                category: img.category || 'gallery',
                title: img.name ? img.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Gallery Image',
                date: img.date ? new Date(img.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }));



            if (galleryData.length === 0) {
                // Clear pagination when no images
                const paginationContainer = document.getElementById('pagination');
                if (paginationContainer) {
                    paginationContainer.innerHTML = '';
                }

                // Check if this is ALL category or specific category
                if (category === 'ALL') {
                    showError('No images found in the gallery. Please upload some images to your Google Drive folder.', false);
                } else {
                    showError(`No images in the "${category}" category yet. Check back soon!`, true);
                }
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
    let currentFilter = 'ALL'; // Track current category

    // Initialize the gallery
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

        // Set filteredGallery to all loaded data (no filtering here, done server-side)
        filteredGallery = [...galleryData];
        currentPage = 1;
        updatePaginatedGallery();
        renderGallery();
        renderPagination();
        setupEventListeners();
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
                // Don't reload if already on this category
                const clickedCategory = button.dataset.filter;
                if (clickedCategory === currentFilter) {
                    return;
                }

                // Update active filter button
                filterButtons.forEach(btn => {
                    btn.classList.remove('bg-primary', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-700');
                });

                button.classList.remove('bg-gray-200', 'text-gray-700');
                button.classList.add('bg-primary', 'text-white');

                currentFilter = clickedCategory;

                // Fetch new data from server based on category
                // Loading state will be handled inside loadGalleryData()
                loadGalleryData(currentFilter);
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
    loadGalleryData('ALL');

    // Timeout fallback
    setTimeout(() => {
        const loadingState = document.getElementById('loadingState');
        if (loadingState && !loadingState.classList.contains('hidden')) {
            hideLoadingIndicator();
            showError('Loading timed out. Please refresh the page.');
        }
    }, 15000);
});