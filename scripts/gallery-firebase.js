import { storage, ref, listAll, getDownloadURL, getMetadata } from './firebase-config.js';

// Hide loading indicator function
function hideLoadingIndicator() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Set current year in footer
    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

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
                <li>Firebase Storage path exists</li>
                <li>Storage rules allow public read access</li>
                <li>Images are uploaded correctly</li>
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

    // Helper to fetch images recursively or from a specific folder
    const fetchImagesFromFolder = async (folderPath, categoryName) => {
        try {
            const folderRef = ref(storage, folderPath);
            const result = await listAll(folderRef);
            
            const imagePromises = result.items.map(async (itemRef) => {
                try {
                    const [url, metadata] = await Promise.all([
                        getDownloadURL(itemRef),
                        getMetadata(itemRef).catch(() => ({}))
                    ]);
                    
                    // Smart Title Cleaning Logic
                    let cleanName = itemRef.name.replace(/\.[^/.]+$/, ''); // Remove extension
                    
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
                        // The Title Case conversion makes it ||date||
                        cleanName = cleanName.replace('||date||', foundDate).replace('||Date||', foundDate);
                    }

                    return {
                        id: itemRef.fullPath,
                        src: url,
                        category: categoryName || 'Gallery',
                        title: cleanName,
                        // Use sortDate if available, otherwise fallback to timeCreated
                        date: metadata.customMetadata?.sortDate || metadata.timeCreated || new Date().toISOString()
                    };
                } catch (err) {
                    console.warn(`Failed to load metadata for ${itemRef.fullPath}:`, err);
                    return null;
                }
            });

            let images = (await Promise.all(imagePromises)).filter(img => img !== null);

            // Also fetch from subfolders if this is the root ALL category
            if (categoryName === 'ALL') {
                const subfolderPromises = result.prefixes.map(prefix => 
                    fetchImagesFromFolder(prefix.fullPath, prefix.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
                );
                const subfolderImages = await Promise.all(subfolderPromises);
                images = images.concat(...subfolderImages);
            }

            return images;
        } catch (error) {
            console.error(`Error fetching folder ${folderPath}:`, error);
            return [];
        }
    };

    // Mapping for user-friendly filter names to storage folder names
    const filterToFolderMap = {
        'Blood Donors': 'blood-donors',
        'Donation Camps': 'donation-camps',
        'Events': 'events',
        'Awards & Recognition': 'awards'
    };

    // Function to load gallery data from Firebase Storage
    const loadGalleryData = async (category = 'ALL') => {
        try {
            // Show loading indicator
            const loadingState = document.getElementById('loadingState');
            if (loadingState) {
                loadingState.classList.remove('hidden');
            }

            // Clear gallery grid
            const galleryGrid = document.getElementById('gallery-grid');
            if (galleryGrid) {
                galleryGrid.innerHTML = '';
            }

            const basePath = 'gallery'; 
            
            let images = [];
            if (category === 'ALL') {
                images = await fetchImagesFromFolder(basePath, 'ALL');
            } else {
                // Map the category filter to the actual folder name
                const folderName = filterToFolderMap[category] || category.toLowerCase().replace(/\s+/g, '-');
                images = await fetchImagesFromFolder(`${basePath}/${folderName}`, category);
            }

            galleryData = images;

            if (galleryData.length === 0) {
                // Clear pagination when no images
                const paginationContainer = document.getElementById('pagination');
                if (paginationContainer) {
                    paginationContainer.innerHTML = '';
                }

                if (category === 'ALL') {
                    showError('No images found in the gallery. Please upload some images to your "gallery" folder in Firebase Storage.', false);
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
            console.error("Firebase Storage Error:", error);
            showError(`Failed to load gallery from Firebase: ${error.message}`);
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
    let currentFilter = 'ALL';

    // Initialize the gallery
    function initGallery() {
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
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        if (filteredGallery.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">No images found in this category.</div>';
            return;
        }

        galleryGrid.innerHTML = paginatedGallery.map((item, index) => {
            return `
                <div class="gallery-item relative group" data-id="${item.id}" data-category="${item.category}">
                    <img src="${item.src}" 
                         alt="${item.title}" 
                         class="gallery-item-image w-full h-full object-cover"
                         loading="lazy"
                         data-item-index="${index}">
                    <div class="gallery-item-overlay">
                        <div class="gallery-item-caption">
                            <h3 class="font-bold text-lg mb-1">${item.title}</h3>
                            <p class="text-sm opacity-90">${formatDate(item.date)}</p>
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

        const showPages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
        let endPage = Math.min(totalPages, startPage + showPages - 1);

        if (endPage - startPage < showPages - 1) {
            startPage = Math.max(1, endPage - showPages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-page" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-page ${i === currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
            }
            paginationHTML += `<button class="pagination-page" data-page="${totalPages}">${totalPages}</button>`;
        }

        paginationHTML += `
            <button class="pagination-next" 
                    ${currentPage === totalPages ? 'disabled' : ''}
                    aria-label="Next page">
                »
            </button>
        `;

        paginationContainer.innerHTML = paginationHTML;

        // Event listeners for pagination
        paginationContainer.querySelectorAll('.pagination-page').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                updatePaginatedGallery();
                renderGallery();
                renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        const prevBtn = paginationContainer.querySelector('.pagination-prev');
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

        const nextBtn = paginationContainer.querySelector('.pagination-next');
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

    // Open lightbox
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

    // Navigate images
    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updateLightbox();
        }
    }

    function nextImage() {
        if (currentImageIndex < filteredGallery.length - 1) {
            currentImageIndex++;
            updateLightbox();
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const clickedCategory = button.dataset.filter;
                if (clickedCategory === currentFilter) return;

                filterButtons.forEach(btn => {
                    btn.classList.remove('bg-primary', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-700');
                });

                button.classList.remove('bg-gray-200', 'text-gray-700');
                button.classList.add('bg-primary', 'text-white');

                currentFilter = clickedCategory;
                loadGalleryData(currentFilter);
            });
        });

        if (closeButton) closeButton.addEventListener('click', closeLightbox);
        if (prevButton) prevButton.addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });
        if (nextButton) nextButton.addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });

        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display === 'flex') {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') prevImage();
                if (e.key === 'ArrowRight') nextImage();
            }
        });

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }

    // Initial load
    loadGalleryData('ALL');
});
