/**
 * LifeSavers United - Donor Registration Interactive Enhancements
 * File: scripts/donor-registration-enhancements.js
 * Handles FAQ accordion toggles, mobile sticky CTA visibility, and WhatsApp sharing.
 */

document.addEventListener('DOMContentLoaded', function () {
    initFaqAccordion();
    initMobileStickyCta();
    initSmoothScrollCtas();
});

/**
 * FAQ Accordion: Accessible single/multi-panel expand & collapse
 */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-accordion-item');
    if (!faqItems.length) return;

    faqItems.forEach(item => {
        const trigger = item.querySelector('.faq-accordion-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', function () {
            const isActive = item.classList.contains('active');

            // Close other items in the same section for cleaner scanning
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    const otherBtn = otherItem.querySelector('.faq-accordion-trigger');
                    if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle current item
            if (isActive) {
                item.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                item.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

/**
 * Mobile Sticky CTA: Automatically hides when the registration form is in view
 * so it never obscures form inputs, captcha, or buttons.
 */
function initMobileStickyCta() {
    const stickyCta = document.getElementById('mobileStickyCta');
    const formSection = document.getElementById('donor-registration-section');

    if (!stickyCta || !formSection) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    stickyCta.classList.add('hidden-by-form');
                } else {
                    stickyCta.classList.remove('hidden-by-form');
                }
            });
        }, {
            root: null,
            threshold: 0.1
        });

        observer.observe(formSection);
    }
}

/**
 * Smooth scrolling for hero and secondary CTAs to the registration form
 */
function initSmoothScrollCtas() {
    const scrollLinks = document.querySelectorAll('a[href^="#donor-registration-section"], a[href^="#donorRegistrationForm"]');
    scrollLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetEl = document.getElementById('donorRegistrationForm') || document.getElementById('donor-registration-section');
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // If it's the form, gently focus the full name field
                const nameInput = document.getElementById('fullName');
                if (nameInput) {
                    setTimeout(() => nameInput.focus({ preventScroll: true }), 600);
                }
            }
        });
    });
}
