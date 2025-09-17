/**
 * Mobile Menu Handler for Life Savers Donors
 * Handles hamburger menu functionality across all pages
 */

class MobileMenu {
    constructor() {
        this.menuButton = null;
        this.mobileMenu = null;
        this.isOpen = false;
        this.isTransitioning = false;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupMobileMenu());
        } else {
            this.setupMobileMenu();
        }
    }

    setupMobileMenu() {
        // Find the hamburger button
        this.menuButton = document.querySelector('.md\\:hidden button');

        if (!this.menuButton) {
            console.warn('Mobile menu button not found');
            return;
        }

        // Create mobile menu structure
        this.createMobileMenu();

        // Add event listeners
        this.addEventListeners();

        // Add CSS for mobile menu
        this.addMobileMenuStyles();
    }

    createMobileMenu() {
        // Find the navigation container
        const nav = document.querySelector('nav');
        if (!nav) return;

        // Find the desktop navigation to clone its links
        const desktopNav = document.querySelector('.hidden.md\\:flex');
        if (!desktopNav) return;

        // Create mobile menu container
        this.mobileMenu = document.createElement('div');
        this.mobileMenu.className = 'mobile-menu hidden';
        this.mobileMenu.id = 'mobile-menu';

        // Create mobile menu content
        const mobileMenuContent = document.createElement('div');
        mobileMenuContent.className = 'mobile-menu-content';

        // Create mobile menu header
        const mobileMenuHeader = document.createElement('div');
        mobileMenuHeader.className = 'mobile-menu-header';
        mobileMenuHeader.innerHTML = `
            <div class="mobile-menu-logo">
                <img src="imgs/Life-saver-united-logo.png" alt="Life Savers Donors Logo" class="h-8 w-auto">
                
            </div>
        `;

        // Clone navigation links from desktop menu
        const navLinks = desktopNav.cloneNode(true);
        navLinks.className = 'mobile-nav-links';

        // Remove the hidden class and adjust styling
        navLinks.classList.remove('hidden', 'md:flex');
        navLinks.classList.add('flex', 'flex-col', 'space-y-4');

        // Update link styling for mobile and add active page detection
        const links = navLinks.querySelectorAll('a');
        const currentPage = this.getCurrentPage();

        links.forEach(link => {
            const href = link.getAttribute('href');
            const isActive = this.isActivePage(href, currentPage);

            if (isActive) {
                link.className = 'mobile-nav-link active text-primary font-semibold bg-primary-50 border-l-4 border-primary py-3 px-4 text-lg transition-smooth';
            } else {
                link.className = 'mobile-nav-link text-text-secondary hover:text-primary hover:bg-gray-50 transition-smooth py-3 px-4 text-lg';
            }
        });

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'mobile-menu-close';
        closeButton.innerHTML = `
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        `;

        // Create mobile menu footer
        const mobileMenuFooter = document.createElement('div');
        mobileMenuFooter.className = 'mobile-menu-footer';
        mobileMenuFooter.innerHTML = `
            <div class="mobile-menu-footer-content">
                <p class="text-sm text-gray-500 text-center">Life Savers United</p>
                <p class="text-xs text-gray-400 text-center mt-1">Saving Lives Together</p>
            </div>
        `;

        // Assemble mobile menu
        mobileMenuContent.appendChild(closeButton);
        mobileMenuContent.appendChild(mobileMenuHeader);
        mobileMenuContent.appendChild(navLinks);
        mobileMenuContent.appendChild(mobileMenuFooter);
        this.mobileMenu.appendChild(mobileMenuContent);

        // Insert mobile menu after the nav
        nav.parentNode.insertBefore(this.mobileMenu, nav.nextSibling);

        // Store references for event listeners
        this.closeButton = closeButton;
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    isActivePage(href, currentPage) {
        // Handle different href formats
        if (href === currentPage) return true;
        if (href === 'index.html' && (currentPage === 'index.html' || currentPage === '')) return true;
        if (href === './' && currentPage === 'index.html') return true;
        if (href === '../index.html' && currentPage === 'index.html') return true;

        // Handle pages in subfolders
        if (href.includes('/') && currentPage.includes('/')) {
            const hrefFile = href.split('/').pop();
            const currentFile = currentPage.split('/').pop();
            return hrefFile === currentFile;
        }

        return false;
    }


    addEventListeners() {
        // Hamburger button click
        this.menuButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close button click
        if (this.closeButton) {
            this.closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeMenu();
            });
        }

        // Close menu when clicking on mobile menu links
        if (this.mobileMenu) {
            const mobileLinks = this.mobileMenu.querySelectorAll('.mobile-nav-link');
            mobileLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeMenu();
                });
            });
        }

        // Close menu when clicking outside - use mousedown instead of click to prevent conflicts
        document.addEventListener('mousedown', (e) => {
            if (this.isOpen && !this.mobileMenu.contains(e.target) && !this.menuButton.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeMenu();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768 && this.isOpen) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        // Prevent multiple rapid clicks
        if (this.isTransitioning) {
            return;
        }

        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        if (!this.mobileMenu) return;

        this.isTransitioning = true;
        this.isOpen = true;
        this.mobileMenu.classList.remove('hidden');

        // Add animation classes
        setTimeout(() => {
            this.mobileMenu.classList.add('mobile-menu-open');
            this.isTransitioning = false;
        }, 10);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Update hamburger icon to X
        this.updateHamburgerIcon(true);
    }

    closeMenu() {
        if (!this.mobileMenu || !this.isOpen) return;

        this.isTransitioning = true;
        this.isOpen = false;
        this.mobileMenu.classList.remove('mobile-menu-open');

        // Remove animation classes and hide
        setTimeout(() => {
            this.mobileMenu.classList.add('hidden');
            this.isTransitioning = false;
        }, 300);

        // Restore body scroll
        document.body.style.overflow = '';

        // Update hamburger icon back to hamburger
        this.updateHamburgerIcon(false);
    }

    updateHamburgerIcon(isOpen) {
        const svg = this.menuButton.querySelector('svg');
        if (!svg) return;

        if (isOpen) {
            // Change to X icon
            svg.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            `;
        } else {
            // Change back to hamburger icon
            svg.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            `;
        }
    }

    addMobileMenuStyles() {
        // Check if styles already exist
        if (document.getElementById('mobile-menu-styles')) return;

        const style = document.createElement('style');
        style.id = 'mobile-menu-styles';
        style.textContent = `
            .mobile-menu {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .mobile-menu.mobile-menu-open {
                opacity: 1;
                visibility: visible;
            }

            .mobile-menu-content {
                position: absolute;
                top: 0;
                right: 0;
                width: 85%;
                max-width: 320px;
                height: 100%;
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
                transform: translateX(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow-y: auto;
                border-left: 1px solid rgba(239, 68, 68, 0.1);
                display: flex;
                flex-direction: column;
            }

            .mobile-menu.mobile-menu-open .mobile-menu-content {
                transform: translateX(0);
            }

            .mobile-menu-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: rgba(239, 68, 68, 0.1);
                border: none;
                color: #ef4444;
                cursor: pointer;
                padding: 0.75rem;
                border-radius: 50%;
                transition: all 0.2s ease;
                width: 2.5rem;
                height: 2.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .mobile-menu-close:hover {
                background: rgba(239, 68, 68, 0.2);
                transform: scale(1.1);
            }

            .mobile-menu-header {
                padding: 1rem 1.5rem;
                border-bottom: 1px solid rgba(239, 68, 68, 0.1);
                margin-bottom: 1rem;
            }

            .mobile-menu-logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .mobile-menu-title {
                font-size: 1.25rem;
                font-weight: 700;
                color: #ef4444;
                letter-spacing: -0.025em;
            }

            .mobile-nav-links {
                padding: 0 0 1rem 0;
                flex: 1;
            }

            .mobile-menu-footer {
                padding: 1rem 1.5rem;
                border-top: 1px solid rgba(239, 68, 68, 0.1);
                margin-top: auto;
            }

            .mobile-menu-footer-content {
                text-align: center;
            }

            .mobile-nav-link {
                display: block;
                padding: 1rem 1.5rem;
                margin: 0.25rem 1rem;
                border-radius: 0.75rem;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                font-weight: 500;
                letter-spacing: 0.025em;
            }

            .mobile-nav-link:hover {
                background-color: rgba(239, 68, 68, 0.05);
                color: #ef4444;
                transform: translateX(4px);
            }

            .mobile-nav-link.active {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
                color: #dc2626;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
            }

            .mobile-nav-link.active::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 4px;
                height: 60%;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                border-radius: 0 2px 2px 0;
            }

            /* Ensure mobile menu is hidden on desktop */
            @media (min-width: 768px) {
                .mobile-menu {
                    display: none !important;
                }
            }

            /* Animation for hamburger button */
            .md\\:hidden button {
                transition: transform 0.2s ease;
            }

            .md\\:hidden button:hover {
                transform: scale(1.1);
            }
        `;

        document.head.appendChild(style);
    }
}

// Initialize mobile menu when script loads
const mobileMenu = new MobileMenu();

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileMenu;
}
