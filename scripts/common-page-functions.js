// Common Page Functions
// This file contains shared functionality used across multiple pages
// Features: smooth scrolling, counter animations, current year setting, etc.

// API Configuration (can be overridden by individual pages)
const COMMON_API_URL = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec';

/**
 * Set the current year in elements with id="currentYear"
 */
function setCurrentYear() {
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Initialize counter animations when they come into view
 */
function initializeCounterAnimations() {
    const counters = document.querySelectorAll('.text-4xl');
    if (counters.length === 0) return;

    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-pulse-gentle');
            }
        });
    }, observerOptions);

    counters.forEach(counter => {
        observer.observe(counter);
    });
}

/**
 * Initialize search functionality for search inputs
 * @param {string} selector - CSS selector for search input (default: 'input[type="text"]')
 */
function initializeSearch(selector = 'input[type="text"]') {
    const searchInput = document.querySelector(selector);
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        // Simple search implementation - can be customized per page
        if (searchTerm.length > 2) {
            console.log('Searching for:', searchTerm);
            // Here you would implement actual search functionality
            // This can be overridden by individual pages
        }
    });
}

/**
 * Initialize all common page functions
 * @param {Object} options - Configuration options
 * @param {boolean} options.smoothScrolling - Enable smooth scrolling (default: true)
 * @param {boolean} options.counterAnimations - Enable counter animations (default: true)
 * @param {boolean} options.currentYear - Set current year (default: true)
 * @param {boolean} options.search - Enable search functionality (default: false)
 * @param {string} options.searchSelector - CSS selector for search input
 */
function initializeCommonPageFunctions(options = {}) {
    const {
        smoothScrolling = true,
        counterAnimations = true,
        currentYear = true,
        search = false,
        searchSelector = 'input[type="text"]'
    } = options;

    if (currentYear) {
        setCurrentYear();
    }

    if (smoothScrolling) {
        initializeSmoothScrolling();
    }

    if (counterAnimations) {
        initializeCounterAnimations();
    }

    if (search) {
        initializeSearch(searchSelector);
    }
}

// Auto-initialize when DOM is ready (for direct script inclusion)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeCommonPageFunctions();
    });
} else {
    // DOM is already ready
    initializeCommonPageFunctions();
}

// Export functions for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setCurrentYear,
        initializeSmoothScrolling,
        initializeCounterAnimations,
        initializeSearch,
        initializeCommonPageFunctions,
        COMMON_API_URL
    };
}
