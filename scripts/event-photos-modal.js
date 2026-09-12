/**
 * LifeSavers United - Event Photos Modal / Lightbox for Homepage & Events
 * Provides interactive full-screen photo viewing with navigation and keyboard support.
 */

(function () {
    let eventGalleryData = [];
    let activeImages = [];
    let activeIndex = 0;
    let activeTitle = "";
    let activeSubtitle = "";
    let activeEventId = "";

    // Fallback data for the flagship event in case fetch is delayed
    const fallbackFlagship = {
        id: "evt-2026-07-15",
        title: "Blood Donation Camp on Birthday of First Lady Smt. Darshana Devi",
        displayDate: "July 15, 2026",
        location: "Raj Bhavan (Lok Bhavan), Gandhinagar, Gujarat",
        image: "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi.webp",
        galleryImages: [
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-1.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-2.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-3.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-4.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-5.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-6.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-7.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-8.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-9.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-10.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-11.webp",
            "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi-at-governor-house-12.webp"
        ]
    };

    async function loadEventsData() {
        try {
            const res = await fetch('data/events.json');
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.events)) {
                    eventGalleryData = json.events;
                }
            }
        } catch (e) {
            console.info("Using local fallback events for photos lightbox");
        }
        if (eventGalleryData.length === 0) {
            eventGalleryData = [fallbackFlagship];
        }
    }

    function initLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox) return;

        const closeBtn = document.getElementById('lightbox-close-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        if (prevBtn) prevBtn.addEventListener('click', prevImage);
        if (nextBtn) nextBtn.addEventListener('click', nextImage);

        // Click outside image container to close
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display === 'flex') {
                if (e.key === 'Escape') closeLightbox();
                else if (e.key === 'ArrowLeft') prevImage();
                else if (e.key === 'ArrowRight') nextImage();
            }
        });

        // Touch swipe support for mobile
        let touchStartX = 0;
        lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchEndX - touchStartX;
            if (Math.abs(diff) > 40) {
                if (diff < 0) nextImage();
                else prevImage();
            }
        }, { passive: true });

        // Check if URL specifies a gallery to open
        const urlParams = new URLSearchParams(window.location.search);
        const galleryParam = urlParams.get('gallery');
        if (galleryParam) {
            setTimeout(() => openEventGalleryModal(galleryParam), 300);
        }
    }

    function updateDisplay() {
        const imgEl = document.getElementById('lightbox-image');
        const captionEl = document.getElementById('lightbox-caption');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (!activeImages || activeImages.length === 0) return;

        if (imgEl) {
            imgEl.src = activeImages[activeIndex];
            imgEl.alt = `${activeTitle} - Photo ${activeIndex + 1}`;
        }

        const total = activeImages.length;
        if (captionEl) {
            captionEl.innerHTML = `
                <strong style="display:block; font-size:1.1rem; font-weight:700; color:#ffffff; margin-bottom:4px; line-height:1.3;">
                    ${activeTitle}
                </strong>
                <div style="font-size:0.875rem; color:#d1d5db; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px;">
                    <span>${activeSubtitle}</span>
                    <span>•</span>
                    <span style="font-weight:600; color:#fca5a5;">Photo ${activeIndex + 1} of ${total}</span>
                    <span>•</span>
                    <a href="/events#${activeEventId}" style="color:#ffffff; text-decoration:underline; font-weight:500;">
                        Read event details &rarr;
                    </a>
                </div>
            `;
        }

        if (prevBtn && nextBtn) {
            if (total > 1) {
                prevBtn.style.display = 'flex';
                nextBtn.style.display = 'flex';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        }
    }

    function openEventGalleryModal(eventId, startIndex = 0) {
        let evt = eventGalleryData.find(e => e.id === eventId);
        if (!evt && eventId === fallbackFlagship.id) {
            evt = fallbackFlagship;
        }
        if (!evt) return;

        activeEventId = evt.id;
        activeTitle = evt.title || "Event Photos";
        activeSubtitle = evt.displayDate ? `${evt.displayDate} • ${evt.location}` : (evt.location || "");

        const imgs = [];
        if (evt.image) imgs.push(evt.image);
        if (Array.isArray(evt.galleryImages)) {
            evt.galleryImages.forEach(src => {
                if (!imgs.includes(src)) imgs.push(src);
            });
        }

        activeImages = imgs.length > 0 ? imgs : ["imgs/lifesavers-United.webp"];
        activeIndex = Math.max(0, Math.min(startIndex, activeImages.length - 1));

        updateDisplay();

        const lightbox = document.getElementById('lightbox');
        if (lightbox) {
            lightbox.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) {
            lightbox.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    function prevImage() {
        if (activeImages.length <= 1) return;
        activeIndex = (activeIndex - 1 + activeImages.length) % activeImages.length;
        updateDisplay();
    }

    function nextImage() {
        if (activeImages.length <= 1) return;
        activeIndex = (activeIndex + 1) % activeImages.length;
        updateDisplay();
    }

    // Expose globally for HTML onclick handlers
    window.openEventGalleryModal = openEventGalleryModal;
    window.closeEventLightbox = closeLightbox;

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadEventsData();
            initLightbox();
        });
    } else {
        loadEventsData();
        initLightbox();
    }
})();
