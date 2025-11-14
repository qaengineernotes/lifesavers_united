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
            console.log('Raw data from server:', data);
            galleryData = data.map((img) => {
                // Log the original image data
                console.log('Processing image:', img.name || 'unnamed');
                
                // Default values
                let category = 'uncategorized';
                let title = img.name ? img.name.replace(/\.[^/.]+$/, '') : 'Untitled';
                let date = img.date ? new Date(img.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                // Try to extract category from filename (format: category_title_YYYY-MM-DD.ext or category_rest_of_name.ext)
                if (img.name) {
                    console.log('Original filename:', img.name);
                    
                    // Split by underscore and log the parts
                    const parts = img.name.split('_');
                    console.log('Filename parts:', parts);
                    
                    if (parts.length >= 3) {
                        // First part is category - normalize to use hyphens
                        category = parts[0].toLowerCase().trim().replace(/_/g, '-');
                        console.log('Extracted category (normalized):', category);
                        
                        // Middle parts are title
                        title = parts.slice(1, -1).join(' ').replace(/[-_]/g, ' ').trim();
                        
                        // Last part might be a date (check if it matches YYYY-MM-DD pattern)
                        const lastPart = parts[parts.length - 1].split('.')[0];
                        const datePattern = /^\d{4}-\d{1,2}-\d{1,2}$/;
                        
                        if (datePattern.test(lastPart)) {
                            date = lastPart;
                            console.log('Extracted date:', date);
                        } else {
                            // If last part isn't a date, include it in the title
                            title = parts.slice(1).join(' ').replace(/[-_]/g, ' ').trim();
                        }
                        
                        console.log('Final title:', title);
                    } else if (parts.length === 2) {
                        // If only one underscore, first part is category, rest is title
                        category = parts[0].toLowerCase().trim().replace(/_/g, '-');
                        title = parts[1].split('.')[0].replace(/-/g, ' ').trim();
                        console.log('Extracted from simple format - Category:', category, 'Title:', title);
                    } else {
                        // For files with no underscores, use the whole name as title
                        title = img.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
                        console.log('Using filename as title:', title);
                    }
                }

                return {
                    id: img.id || Date.now() + Math.random(),
                    src: convertDriveUrlToViewable(img.url || ''),
                    category: img.category || category,
                    title: img.title || title,
                    date: date
                };
            });
            
            console.log('Processed gallery data:', galleryData);

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
        console.log('=== FILTERING GALLERY ===');
        console.log('Current filter:', currentFilter);
        
        // Log all available categories for debugging
        const allCategories = [...new Set(galleryData.map(item => item.category))];
        console.log('All available categories:', allCategories);
        
        if (currentFilter === 'all') {
            console.log('Showing all items');
            filteredGallery = [...galleryData];
        } else {
            console.log(`Filtering for category: '${currentFilter}'`);
            filteredGallery = galleryData.filter(item => {
                if (!item) return false;
                
                // Normalize categories for comparison (handle both hyphens and underscores)
                const normalizeCategory = (cat) => {
                    if (!cat) return '';
                    return cat.trim().toLowerCase().replace(/_/g, '-');
                };
                
                const itemCategory = normalizeCategory(item.category || 'uncategorized');
                const filterCategory = normalizeCategory(currentFilter);
                
                console.log(`Comparing - Item: '${itemCategory}', Filter: '${filterCategory}'`);
                
                // Handle 'all' filter
                if (filterCategory === 'all') return true;
                
                // Handle 'uncategorized' filter
                if (filterCategory === 'uncategorized') {
                    return itemCategory === 'uncategorized' || !itemCategory;
                }
                
                // Check for exact match or partial match
                const isMatch = itemCategory === filterCategory || 
                               itemCategory.includes(filterCategory) || 
                               filterCategory.includes(itemCategory);
                
                console.log(`Item: '${item.title}', Category: '${item.category}', Match: ${isMatch ? 'YES' : 'no'}`);
                return isMatch;
            });
        }
        
        console.log(`Found ${filteredGallery.length} items for filter: ${currentFilter}`);
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
                // Update active filter button styles
                filterButtons.forEach(btn => {
                    btn.classList.remove('bg-primary', 'text-white');
                    btn.classList.add('bg-gray-200', 'hover:bg-gray-300');
                });
                
                button.classList.remove('bg-gray-200', 'hover:bg-gray-300');
                button.classList.add('bg-primary', 'text-white');

                // Update current filter and refresh the gallery
                currentFilter = button.getAttribute('data-category');
                console.log('Filter changed to:', currentFilter);
                
                // Reset to first page and update the gallery
                currentPage = 1;
                filterGallery();
                renderGallery();
                renderPagination();

                // Smooth scroll to top of gallery
                const gallerySection = document.querySelector('section.py-12');
                if (gallerySection) {
                    gallerySection.scrollIntoView({ behavior: 'smooth' });
                }
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

    // Add a test image for debugging
    const testImage = {
        id: 'test-' + Date.now(),
        src: 'https://via.placeholder.com/300',
        category: 'blood-donation-camp', // Using hyphens for consistency
        title: 'Test Blood Donation Camp',
        date: new Date().toISOString().split('T')[0]
    };
    console.log('Test image category:', testImage.category);
    
    // Initialize the gallery when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        // Set the 'All' filter as active by default
        const allFilterButton = document.querySelector('.filter-btn[data-category="all"]');
            filterGallery();
            renderGallery();
            renderPagination();

            // Smooth scroll to top of gallery
            const gallerySection = document.querySelector('section.py-12');
            if (gallerySection) {
                gallerySection.scrollIntoView({ behavior: 'smooth' });
            }
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

// Add a test image for debugging
const testImage = {
    id: 'test-' + Date.now(),
    src: 'https://via.placeholder.com/300',
    category: 'blood-donation-camp', // Using hyphens for consistency
    title: 'Test Blood Donation Camp',
    date: new Date().toISOString().split('T')[0]
};
console.log('Test image category:', testImage.category);

// Function to load test data when Google Apps Script is not available
const loadTestData = () => {
    console.log('Loading test data...');
    const testImages = [
        {
            id: 'test1',
            src: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format',
            category: 'blood-donation-camp',
            title: 'Blood Donation Camp 2023',
            date: '2023-10-15'
        },
        {
            id: 'test2',
            src: 'https://images.unsplash.com/photo-1579165466743-6daa6a6cf2eb?w=800&auto=format',
            category: 'events',
            title: 'Annual Health Checkup',
            date: '2023-09-20'
        },
        {
            id: 'test3',
            src: 'https://images.unsplash.com/photo-1576091160399-112ba82b3f96?w=800&auto=format',
            category: 'volunteers',
            title: 'Volunteer Team',
            date: '2023-08-10'
        },
        {
            id: 'test4',
            src: 'https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?w=800&auto=format',
            category: 'awards',
            title: 'Best Community Service Award',
            date: '2023-07-05'
        }
    ];

    galleryData = [...testImages, testImage]; // Include our test image too
    console.log('Test data loaded:', galleryData);
    
    // Update the UI
    filterGallery();
    renderGallery();
    renderPagination();
    hideLoadingIndicator();
};

// Try to load from Google Apps Script, fallback to test data
const scriptUrl = 'https://script.google.com/macros/s/AKfycbzQFclRK_YZ9lzxYNkT1Y4wQBNNaqoZk6oTiZCQHu9_uTIbS9a0175wz6vkjsYhB69X1A/exec';
    
// First try to load from Google Apps Script
fetch(`${scriptUrl}?t=${new Date().getTime()}`)
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        console.log('Data loaded from Google Apps Script:', data);
        // Process the data as before
        processGalleryData(data);
    })
    .catch(error => {
        console.warn('Error loading from Google Apps Script, using test data:', error);
        loadTestData();
    });
    
function processGalleryData(data) {
    if (data && Array.isArray(data)) {
        galleryData = data.map(img => {
            // Your existing image processing logic here
            return {
                id: img.id || Date.now() + Math.random(),
                src: convertDriveUrlToViewable(img.url || ''),
                category: img.category || 'uncategorized',
                title: img.title || 'Untitled',
        
        console.log('Processed gallery data:', galleryData);
        filterGallery();
        renderGallery();
        renderPagination();
    } else {
        console.warn('Invalid data format from server, using test data');
        loadTestData();
    }
}

// Initialize the gallery when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set the 'All' filter as active by default
    const allFilterButton = document.querySelector('.filter-btn[data-category="all"]');
    if (allFilterButton) {
        allFilterButton.classList.remove('bg-gray-200', 'hover:bg-gray-300');
        allFilterButton.classList.add('bg-primary', 'text-white');
    }
    
    // Try to load from Google Apps Script with a timeout
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbzQFclRK_YZ9lzxYNkT1Y4wQBNNaqoZk6oTiZCQHu9_uTIbS9a0175wz6vkjsYhB69X1A/exec';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    fetch(`${scriptUrl}?t=${new Date().getTime()}`, { signal: controller.signal })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            console.log('Data loaded from Google Apps Script:', data);
            processGalleryData(data);
        })
        .catch(error => {
            console.warn('Error loading from Google Apps Script, using test data:', error);
            loadTestData();
        });
});