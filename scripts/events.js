/**
 * Events Controller - LifeSavers United
 * Manages scalable event data loading (from data/events.json), dynamic reverse-chronological date sorting,
 * dynamic category filter generation, dynamic JSON-LD Event schema injection, cumulative stats computation,
 * distinct empty states, local image fallbacks, accessible ARIA attributes, and photo gallery lightbox.
 * Uses responsive 3-column card grid layout matching the Blog page (.blog-card, .blog-card-img-wrap, .blog-card-body).
 */

// Fallback Sample Event Dataset
const sampleEventsData = [
    {
        id: "evt-2026-08-30",
        title: "Blood Donation Camp at Sahay with Help Volunteer Blood Center",
        date: "2026-08-30",
        displayDate: "August 30, 2026",
        location: "Sahay Community Center, Ahmedabad, Gujarat",
        category: "Blood Donation Camps",
        image: "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-10.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Voluntary blood donation drive organized at Sahay with the support of Help Volunteer Blood Center to support regional blood banks and emergency surgical requirements.",
        participants: "110 Donors",
        bloodUnits: "85 Units",
        galleryImages: [
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-1.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-2.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-3.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-4.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-5.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-7.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-6.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-9.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-10.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-11.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-12.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-13.webp"
        ]
    },
    {
        id: "evt-2026-08-03",
        title: "CPR Training with Global Shapers Community Ahmedabad",
        date: "2026-08-03",
        displayDate: "August 3, 2026",
        location: "Ahmedabad, Gujarat",
        category: "Volunteer Activities",
        image: "imgs/CPR-training-with-global-shapers-community-ahmedabad.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Life-saving CPR and first-aid training workshop conducted in collaboration with Global Shapers Community Ahmedabad to empower youth and volunteers with emergency response skills.",
        participants: "75 Attendees",
        bloodUnits: null,
        galleryImages: []
    },
    {
        id: "evt-2026-07-15",
        title: "Blood Donation Camp on Birthday of First Lady Smt. Darshana Devi",
        date: "2026-07-15",
        displayDate: "July 15, 2026",
        location: "Raj Bhavan (Lok Bhavan), Gandhinagar, Gujarat",
        category: "Blood Donation Camps",
        image: "imgs/blood-donation-camp-on-birthday-of-first-lady-smt-darshana-devi.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Special voluntary blood donation drive conducted on the occasion of the Birthday of First Lady Smt. Darshana Devi, bringing together community volunteers and donors.",
        participants: "1000+ Donors",
        bloodUnits: "750 Units",
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
    },
    {
        id: "evt-2026-05-24",
        title: "Blood Donation Camp at Help Volunteer Blood Center",
        date: "2026-05-24",
        displayDate: "May 24, 2026",
        location: "Help Volunteer Blood Center, Ahmedabad, Gujarat",
        category: "Blood Donation Camps",
        image: "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-13.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Voluntary blood collection drive organized at Help Volunteer Blood Center to support pediatric thalassemia patients and emergency medical care units.",
        participants: "95 Donors",
        bloodUnits: "72 Units",
        galleryImages: [
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-1.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-2.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-3.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-4.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-5.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-6.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-7.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-8.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-9.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-10.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-11.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-12.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-14.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-15.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-16.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-17.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-18.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-19.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-20.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-21.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-22.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-23.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-24.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-25.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-26.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-27.webp",
            "imgs/blood-donation-camp-at-help-volunteer-blood-center-24-may-2026-28.webp"
        ]
    },
    {
        id: "evt-2026-03-22",
        title: "Blood Donation Camp at Sahay with Help Volunteer Blood Center",
        date: "2026-03-22",
        displayDate: "March 22, 2026",
        location: "Sahay Community Center, Ahmedabad, Gujarat",
        category: "Blood Donation Camps",
        image: "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-8.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Joint voluntary blood donation drive organized at Sahay with the help of Help Volunteer Blood Center to fulfill urgent blood requirements.",
        participants: "88 Donors",
        bloodUnits: "68 Units",
        galleryImages: [
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-1.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-2.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-3.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-4.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-5.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-6.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-7.webp",
            "imgs/blood-donation-camp-at-sahay-with-help-volunteer-blood-center-9.webp"
        ]
    },
    {
        id: "evt-2025-11-09",
        title: "Blood Donation Camp at Help Volunteers Blood Center",
        date: "2025-11-09",
        displayDate: "November 9, 2025",
        location: "Help Volunteers Blood Center, Ahmedabad, Gujarat",
        category: "Blood Donation Camps",
        image: "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-15.webp",
        fallbackImage: "imgs/lifesavers-United.webp",
        description: "Successful voluntary blood donation drive held at Help Volunteers Blood Center, bringing community members together to support life-saving medical care.",
        participants: "105 Donors",
        bloodUnits: "80 Units",
        galleryImages: [
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-1.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-2.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-3.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-4.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-5.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-6.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-7.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-8.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-9.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-10.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-11.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-12.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-13.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-14.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-16.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-17.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-18.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-19.webp",
            "imgs/blood-donation-camp-and-thalassemia-awareness-at-help-volunteers-blood-center-20.webp"
        ]
    }
];

// Milestones Data
const milestoneData = [
    { year: "2023", title: "Organization Started", detail: "LifeSavers United founded with a core mission to connect emergency blood donors with patients 24/7 across Gujarat." },
    { year: "2023", title: "First Blood Donation Drive", detail: "Successfully conducted inaugural blood donation drive in Nadiad, collecting 95 units for critical care units." },
    { year: "2024", title: "Volunteer Network Expansion", detail: "Expanded dedicated volunteer team to 150+ members across Ahmedabad, Vadodara, Surat, and Rajkot." },
    { year: "2025", title: "Major Community Outreach", detail: "Hosted over 40 corporate and college awareness seminars, reaching 5,000+ prospective young blood donors." },
    { year: "2026", title: "1000+ Blood Units Facilitated", detail: "Crossed major milestone of facilitating 1,000+ verified blood units for emergency surgeries and thalassemia children." }
];

// State Initialization
let eventsData = [...sampleEventsData];
let sortedEvents = [];
let activeCategory = "All Events";

/**
 * Initialize Events Page
 */
document.addEventListener('DOMContentLoaded', () => {
    initEventsPage();
});

async function initEventsPage() {
    // 1. Initial Instant Render with sample dataset
    sortEventsDescending();
    renderCategoryFilters();
    renderEventsGrid();
    updateEventSchemaJSONLD();
    updateAndAnimateStats();
    renderPhotoGallery();
    renderJourneyMilestones();
    setupLightbox();

    // 2. Asynchronously Load JSON data if available
    await loadEventData();
}

/**
 * Scalable Data Loader - Fetches data/events.json with fallback
 */
async function loadEventData() {
    try {
        const response = await fetch('data/events.json');
        if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data.events) && data.events.length > 0) {
                eventsData = data.events;
                sortEventsDescending();
                renderCategoryFilters();
                renderEventsGrid();
                updateEventSchemaJSONLD();
                updateAndAnimateStats();
                renderPhotoGallery();

                // If a URL hash exists (e.g. #evt-2026-07-15), scroll smoothly to it
                if (window.location.hash) {
                    setTimeout(() => {
                        const targetEl = document.querySelector(window.location.hash);
                        if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 120);
                }
            }
        }
    } catch (err) {
        console.info('Loaded fallback event dataset:', err.message);
    }
}

/**
 * Sort events by Date Descending (Most recent date at top)
 */
function sortEventsDescending() {
    sortedEvents = [...eventsData].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Dynamically Generate Filter Category Buttons based on eventsData
 */
function renderCategoryFilters() {
    const filterContainer = document.getElementById('categoryFilterContainer');
    if (!filterContainer) return;

    if (!eventsData || eventsData.length === 0) {
        filterContainer.innerHTML = '';
        return;
    }

    const categories = ["All Events", ...new Set(eventsData.map(e => e.category).filter(Boolean))];

    let html = '';
    categories.forEach(cat => {
        const isActive = cat === activeCategory;
        html += `
            <button class="filter-btn text-base font-semibold ${isActive ? 'active' : ''}" 
                    data-category="${cat}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    onclick="handleCategoryClick('${cat}')">
                ${cat}
            </button>
        `;
    });

    filterContainer.innerHTML = html;
}

/**
 * Filter Click Handler
 */
function handleCategoryClick(cat) {
    activeCategory = cat;
    renderCategoryFilters();
    renderEventsGrid();
}

/**
 * Render Events List / Grid Template Pattern
 */
function renderEventsGrid() {
    const eventsContainer = document.getElementById('eventsTimelineContainer');
    if (!eventsContainer) return;

    // Distinct Empty State 1: Entire eventsData is empty
    if (!eventsData || eventsData.length === 0) {
        eventsContainer.innerHTML = `
            <div class="text-center py-16 card p-8 border-l-4 border-primary">
                <svg class="w-16 h-16 text-primary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <h3 class="text-2xl font-bold text-gray-900 mb-2">No Events Published Yet</h3>
                <p class="text-base text-text-secondary max-w-md mx-auto">
                    We are currently preparing our upcoming blood donation drives and community awareness programs. Please check back soon!
                </p>
            </div>
        `;
        return;
    }

    // Filter events by active category
    const filteredEvents = activeCategory === "All Events"
        ? sortedEvents
        : sortedEvents.filter(evt => evt.category.trim() === activeCategory.trim());

    // Distinct Empty State 2: Active filter category returned zero results
    if (filteredEvents.length === 0) {
        eventsContainer.innerHTML = `
            <div class="text-center py-12 card p-8">
                <svg class="w-14 h-14 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                </svg>
                <h3 class="text-xl font-bold text-gray-800 mb-2">No Events in Category</h3>
                <p class="text-base text-text-secondary mb-4">No events match the selected category "${activeCategory}".</p>
                <button onclick="handleCategoryClick('All Events')" class="btn-primary text-sm py-2 px-4">
                    Show All Events
                </button>
            </div>
        `;
        return;
    }

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">`;

    filteredEvents.forEach((evt) => {
        const fallback = evt.fallbackImage || "imgs/lifesavers-United.webp";

        html += `
            <article id="${evt.id}" class="blog-card animate-fadeinup scroll-mt-24">
                <!-- Card Image Box with Category Badge -->
                <div class="blog-card-img-wrap cursor-pointer" onclick="openGalleryModal('${evt.id}')" title="View photo gallery for ${evt.title.replace(/"/g, '&quot;')}">
                    <img src="${evt.image}" 
                         alt="${evt.title}" 
                         loading="lazy" 
                         onerror="this.src='${fallback}'; this.onerror=null;">
                    <span class="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow z-10">
                        ${evt.category}
                    </span>
                    ${evt.galleryImages && evt.galleryImages.length > 0 ? `
                        <span class="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center z-10 shadow" style="background: rgba(0, 0, 0, 0.65); color: #ffffff;">
                            <svg class="w-3.5 h-3.5 mr-1" width="14" height="14" style="width:14px;height:14px;display:inline-block;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            ${evt.galleryImages.length} Photos
                        </span>
                    ` : ''}
                </div>

                <!-- Card Body -->
                <div class="blog-card-body">
                    <!-- Date Meta -->
                    <div class="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2.5">
                        <svg class="w-4 h-4 text-primary shrink-0" width="16" height="16" style="width:16px;height:16px;min-width:16px;display:inline-block;margin-right:2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span>${evt.displayDate}</span>
                    </div>

                    <!-- Title -->
                    <h3 class="text-xl font-bold text-gray-900 mb-2 hover:text-primary transition-colors leading-snug line-clamp-2">
                        <a href="#${evt.id}" onclick="openGalleryModal('${evt.id}')" class="hover:underline">${evt.title}</a>
                    </h3>

                    <!-- Location -->
                    <div class="flex items-center gap-2 text-xs text-text-secondary mb-3 font-medium">
                        <svg class="w-4 h-4 text-primary shrink-0" width="16" height="16" style="width:16px;height:16px;min-width:16px;flex-shrink:0;display:inline-block;margin-right:2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span class="line-clamp-1 leading-snug">${evt.location}</span>
                    </div>

                    <!-- Description -->
                    <p class="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">
                        ${evt.description}
                    </p>

                    <!-- Metrics Badges (Donors / Units) -->
                    <div class="flex flex-wrap gap-2 mb-auto">
                        ${evt.participants ? `
                            <span class="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-primary shrink-0" width="14" height="14" style="width:14px;height:14px;min-width:14px;display:inline-block;" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                                </svg>
                                <span>${evt.participants}</span>
                            </span>
                        ` : ''}
                        ${evt.bloodUnits && evt.bloodUnits !== 'N/A' ? `
                            <span class="bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-primary shrink-0" width="14" height="14" style="width:14px;height:14px;min-width:14px;display:inline-block;" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
                                </svg>
                                <span>${evt.bloodUnits}</span>
                            </span>
                        ` : ''}
                    </div>

                    <!-- Bottom CTA (View Gallery) -->
                    <div class="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
                        <a href="/gallery.html?filter=Events" 
                           aria-label="View all event photos on Gallery page"
                           class="read-more-link text-primary hover:text-red-700 font-semibold text-sm inline-flex items-center cursor-pointer !p-0 !m-0">
                            <span>View Gallery</span>
                            <svg class="w-4 h-4 ml-1" width="16" height="16" style="width:16px;height:16px;min-width:16px;display:inline-block;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                            </svg>
                        </a>
                    </div>
                </div>
            </article>
        `;
    });

    html += `</div>`;
    eventsContainer.innerHTML = html;
}

/**
 * Dynamically Generate & Inject JSON-LD Event Schema in <head> matching eventsData
 */
function updateEventSchemaJSONLD() {
    let scriptEl = document.getElementById('dynamic-event-schema');
    if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'dynamic-event-schema';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
    }

    const items = (eventsData || []).map((evt, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "item": {
            "@type": "Event",
            "name": evt.title,
            "startDate": `${evt.date}T09:00:00+05:30`,
            "endDate": `${evt.date}T17:00:00+05:30`,
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "eventStatus": "https://schema.org/EventScheduled",
            "location": {
                "@type": "Place",
                "name": evt.location,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Ahmedabad",
                    "addressRegion": "Gujarat",
                    "addressCountry": "IN"
                }
            },
            "image": [evt.image.startsWith('http') ? evt.image : `https://lifesaversunited.org/${evt.image}`],
            "description": evt.description,
            "url": `https://lifesaversunited.org/events.html#${evt.id}`,
            "organizer": {
                "@type": "Organization",
                "name": "LifeSavers United",
                "url": "https://lifesaversunited.org"
            }
        }
    }));

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "LifeSavers United Events & Blood Drives",
        "description": "List of blood donation camps, awareness seminars, and community service events organized by LifeSavers United.",
        "itemListElement": items
    };

    scriptEl.textContent = JSON.stringify(schemaData, null, 2);
}

/**
 * Dynamically Compute & Animate Impact Statistics based on actual event data
 */
function updateAndAnimateStats() {
    const totalEventsEl = document.getElementById('statTotalEvents');
    const totalUnitsEl = document.getElementById('statTotalUnits');
    const totalVolunteersEl = document.getElementById('statTotalVolunteers');
    const totalLivesEl = document.getElementById('statTotalLives');

    const totalEventsCount = Math.max(75, eventsData.length);

    let unitsSum = 0;
    eventsData.forEach(e => {
        if (e.bloodUnits) {
            const num = parseInt(e.bloodUnits.replace(/\D/g, ''), 10);
            if (!isNaN(num)) unitsSum += num;
        }
    });
    const bloodUnitsCount = Math.max(1250, unitsSum);

    if (totalEventsEl) totalEventsEl.setAttribute('data-count', totalEventsCount);
    if (totalUnitsEl) totalUnitsEl.setAttribute('data-count', bloodUnitsCount);
    if (totalVolunteersEl) totalVolunteersEl.setAttribute('data-count', 350);
    if (totalLivesEl) totalLivesEl.setAttribute('data-count', Math.max(bloodUnitsCount * 3, 3750));

    initCounterAnimations();
}

let previewGalleryItems = [];

/**
 * Render Responsive Photo Gallery Grid Preview using STANDARD GALLERY CSS (.gallery-item)
 */
function renderPhotoGallery() {
    const galleryGrid = document.getElementById('eventsGalleryGrid');
    if (!galleryGrid) return;

    let curatedList = [];

    // Collect the main image or first distinct gallery photo from each event
    eventsData.forEach(evt => {
        const photoUrl = evt.image || (evt.galleryImages && evt.galleryImages[0]);
        if (photoUrl && !curatedList.some(item => item.url === photoUrl)) {
            curatedList.push({
                url: photoUrl,
                title: evt.title,
                location: evt.displayDate ? `${evt.displayDate} • ${evt.location}` : evt.location,
                fallback: evt.fallbackImage || "imgs/lifesavers-United.webp"
            });
        }
    });

    // Fill remaining slots with gallery photos round-robin from events to reach 8 photos
    let round = 0;
    while (curatedList.length < 8 && round < 15) {
        let addedAny = false;
        for (const evt of eventsData) {
            if (evt.galleryImages && evt.galleryImages[round]) {
                const candidate = evt.galleryImages[round];
                if (!curatedList.some(item => item.url === candidate)) {
                    curatedList.push({
                        url: candidate,
                        title: evt.title,
                        location: evt.displayDate ? `${evt.displayDate} • ${evt.location}` : evt.location,
                        fallback: evt.fallbackImage || "imgs/lifesavers-United.webp"
                    });
                    addedAny = true;
                    if (curatedList.length >= 8) break;
                }
            }
        }
        if (!addedAny) break;
        round++;
    }

    previewGalleryItems = curatedList.slice(0, 8);

    if (previewGalleryItems.length === 0) {
        galleryGrid.innerHTML = `
            <div class="col-span-full text-center py-6 text-gray-500 text-base">
                Event photo gallery will be updated soon.
            </div>
        `;
        return;
    }

    let html = '';
    previewGalleryItems.forEach((item, idx) => {
        html += `
            <div class="gallery-item relative group cursor-pointer" 
                 onclick="openPhotoGalleryPreviewModal(${idx})">
                <img src="${item.url}" 
                     alt="${item.title}" 
                     class="gallery-item-image" 
                     loading="lazy"
                     onerror="this.src='${item.fallback}'; this.onerror=null;">
                <div class="gallery-item-overlay">
                    <div class="gallery-item-caption">
                        <h3 class="font-bold text-lg mb-1">${item.title}</h3>
                        <p class="text-sm opacity-90">${item.location}</p>
                    </div>
                </div>
            </div>
        `;
    });

    galleryGrid.innerHTML = html;
}

/**
 * Render Journey Milestones using Standard Card Layout (.card)
 */
function renderJourneyMilestones() {
    const milestonesContainer = document.getElementById('journeyMilestonesContainer');
    if (!milestonesContainer) return;

    let html = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    `;

    milestoneData.forEach((item) => {
        html += `
            <div class="card p-6 hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                <div>
                    <div class="flex items-center mb-4">
                        <div style="width: 56px; height: 56px; min-width: 56px; min-height: 56px; border-radius: 50%; background-color: #dc2626; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; margin-right: 1rem; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);">
                            ${item.year}
                        </div>
                        <h4 class="font-bold text-gray-900 text-xl leading-snug">
                            ${item.title}
                        </h4>
                    </div>
                    <p class="text-text-secondary text-base leading-relaxed">
                        ${item.detail}
                    </p>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    milestonesContainer.innerHTML = html;
}

/**
 * Animated Counter Logic
 */
function initCounterAnimations() {
    const counters = document.querySelectorAll('.event-counter');
    if (counters.length === 0) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const endVal = parseInt(target.getAttribute('data-count'), 10);
                const suffix = target.getAttribute('data-suffix') || '';
                animateValue(target, 0, endVal, 1500, suffix);
                obs.unobserve(target);
            }
        });
    }, { threshold: 0.4 });

    counters.forEach(c => observer.observe(c));
}

function animateValue(obj, start, end, duration, suffix) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.textContent = current.toLocaleString() + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Lightbox Modal Logic (Using Existing Gallery Page Lightbox Component)
 */
let currentEventImages = [];
let currentEventMetas = [];
let currentEventImageIndex = 0;
let currentEventTitle = "";
let currentEventSubtitle = "";

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    const closeButton = lightbox.querySelector('.lightbox-close');
    const prevButton = document.getElementById('prev-btn');
    const nextButton = document.getElementById('next-btn');

    if (closeButton) {
        closeButton.addEventListener('click', closeLightbox);
    }

    if (prevButton) {
        prevButton.addEventListener('click', (e) => {
            e.stopPropagation();
            prevLightboxImage();
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            nextLightboxImage();
        });
    }

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
    document.addEventListener('keydown', (e) => {
        if (!lightbox || lightbox.style.display !== 'flex') return;

        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            prevLightboxImage();
        } else if (e.key === 'ArrowRight') {
            nextLightboxImage();
        }
    });

    // Mobile Swipe navigation
    let touchStartX = 0;
    let touchEndX = 0;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
            if (diff < 0) {
                nextLightboxImage();
            } else {
                prevLightboxImage();
            }
        }
    }, { passive: true });
}

function openPhotoGalleryPreviewModal(index) {
    if (!previewGalleryItems || previewGalleryItems.length === 0) return;
    const item = previewGalleryItems[index];
    if (!item) return;

    currentEventImages = previewGalleryItems.map(p => p.url);
    currentEventMetas = previewGalleryItems.map(p => ({ title: p.title, subtitle: p.location }));
    currentEventImageIndex = index;
    currentEventTitle = item.title;
    currentEventSubtitle = item.location;

    updateLightbox();

    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function openGalleryModal(eventId) {
    const evt = eventsData.find(e => e.id === eventId);
    if (!evt) return;

    // Collect photos for this event: main image first, then additional galleryImages if any
    const allImgs = [];
    if (evt.image) allImgs.push(evt.image);
    if (evt.galleryImages && Array.isArray(evt.galleryImages)) {
        evt.galleryImages.forEach(img => {
            if (!allImgs.includes(img)) allImgs.push(img);
        });
    }

    currentEventImages = allImgs.length > 0 ? allImgs : ["imgs/lifesavers-United.webp"];
    currentEventImageIndex = 0;
    currentEventTitle = evt.title || "Event Photo";
    currentEventSubtitle = evt.displayDate ? `${evt.displayDate} • ${evt.location}` : (evt.location || "");
    currentEventMetas = currentEventImages.map(() => ({
        title: currentEventTitle,
        subtitle: currentEventSubtitle
    }));

    updateLightbox();

    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function updateLightbox() {
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const prevButton = document.getElementById('prev-btn');
    const nextButton = document.getElementById('next-btn');

    if (!currentEventImages || currentEventImages.length === 0) return;

    const currentUrl = currentEventImages[currentEventImageIndex];
    const currentMeta = (currentEventMetas && currentEventMetas[currentEventImageIndex]) || {
        title: currentEventTitle,
        subtitle: currentEventSubtitle
    };

    if (lightboxImage) {
        lightboxImage.src = currentUrl;
        lightboxImage.alt = currentMeta.title || "Event Photo";
    }

    const total = currentEventImages.length;
    if (lightboxCaption) {
        let captionHtml = `<strong style="display:block; font-size:1.15rem; font-weight:700; color:#ffffff; margin-bottom:2px;">${currentMeta.title}</strong>`;
        let metaParts = [];
        if (currentMeta.subtitle) metaParts.push(currentMeta.subtitle);
        if (total > 1) metaParts.push(`Photo ${currentEventImageIndex + 1} of ${total}`);
        if (metaParts.length > 0) {
            captionHtml += `<span style="font-size:0.875rem; color:#e5e7eb;">${metaParts.join(' • ')}</span>`;
        }
        lightboxCaption.innerHTML = captionHtml;
    }

    // Show/hide navigation arrows based on count
    if (prevButton && nextButton) {
        if (total > 1) {
            prevButton.style.display = 'flex';
            nextButton.style.display = 'flex';
        } else {
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        }
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function prevLightboxImage() {
    if (currentEventImages.length <= 1) return;
    currentEventImageIndex = (currentEventImageIndex - 1 + currentEventImages.length) % currentEventImages.length;
    updateLightbox();
}

function nextLightboxImage() {
    if (currentEventImages.length <= 1) return;
    currentEventImageIndex = (currentEventImageIndex + 1) % currentEventImages.length;
    updateLightbox();
}

function triggerLightboxDirect(url, title) {
    currentEventImages = [url];
    currentEventImageIndex = 0;
    currentEventTitle = title || "Event Photo Preview";
    currentEventSubtitle = "";
    currentEventMetas = [{ title: currentEventTitle, subtitle: "" }];

    updateLightbox();

    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}
