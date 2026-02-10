/**
 * Stories Page JavaScript - Simplified Version
 * Shows full stories in expanded cards without modals
 */

let allStories = [];
let currentFilter = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    loadStories();
    setupEventListeners();
});

/**
 * Load stories from JSON file
 */
async function loadStories() {
    try {
        const response = await fetch('/data/stories.json');
        const data = await response.json();
        allStories = data.stories;

        // Update stats
        updateStats(data.stats);

        // Display stories (sorted by newest first)
        const sortedStories = [...allStories].sort((a, b) => new Date(b.date) - new Date(a.date));
        displayStories(sortedStories);

    } catch (error) {
        console.error('Error loading stories:', error);
        showError('Unable to load stories. Please try again later.');
    }
}

/**
 * Setup event listeners for filters
 */
function setupEventListeners() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Apply filter
            currentFilter = this.dataset.filter;
            filterAndDisplayStories();
        });
    });
}

/**
 * Filter and display stories based on current filter
 */
function filterAndDisplayStories() {
    let filteredStories = [...allStories];

    // Apply type filter
    if (currentFilter !== 'all') {
        filteredStories = filteredStories.filter(story => story.type === currentFilter);
    }

    // Sort by newest first
    filteredStories = filteredStories.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Display filtered stories
    displayStories(filteredStories);
}

/**
 * Display stories in the grid
 */
function displayStories(stories) {
    const storiesGrid = document.getElementById('storiesGrid');

    if (!storiesGrid) return;

    // Clear existing content
    storiesGrid.innerHTML = '';

    if (stories.length === 0) {
        storiesGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl text-gray-500">No stories found matching your criteria.</p>
                <p class="text-gray-400 mt-2">Try adjusting your filters or search terms.</p>
            </div>
        `;
        return;
    }

    // Display all stories
    stories.forEach(story => {
        storiesGrid.appendChild(createStoryCard(story));
    });
}

/**
 * Create a story card with full content
 */
function createStoryCard(story) {
    const card = document.createElement('div');
    card.className = 'story-card bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-smooth mb-8';

    const typeInfo = getStoryTypeInfo(story.type);
    const dateFormatted = formatDate(story.date);

    card.innerHTML = `
        <div class="grid md:grid-cols-3 gap-0">
            <!-- Image Section (1/3 width) -->
            <div class="relative md:col-span-1">
                <img src="${story.image}" alt="${story.title}" 
                     class="w-full h-full object-cover min-h-[300px]"
                     onerror="this.src='https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'">
                <div class="absolute top-4 left-4">
                    <span class="badge badge-${story.type}">
                        ${typeInfo.icon}
                        ${typeInfo.label}
                    </span>
                </div>
            </div>
            
            <!-- Content Section (2/3 width) -->
            <div class="md:col-span-2 p-6 md:p-8">
                <h3 class="text-2xl font-bold text-gray-800 mb-3">${story.title}</h3>
                
                <div class="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
                    <span class="flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                        </svg>
                        ${story.name}
                    </span>
                    ${story.age ? `<span> • </span><span>Age ${story.age}</span>` : ''}
                    ${story.bloodGroup ? `<span> • </span><span>${story.bloodGroup}</span>` : ''}
                    <span> • </span>
                    <span>${dateFormatted}</span>
                </div>
                
                ${getStoryMetrics(story)}
                
                <div class="max-w-none mt-4 mb-4">
                    <p class="text-gray-700 leading-relaxed">${story.fullStory}</p>
                </div>
                
                ${story.testimonial ? `
                <div class="bg-accent-50 border-l-4 border-accent rounded-lg p-4 mb-4">
                    <svg class="w-6 h-6 text-accent mb-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                    </svg>
                    <p class="text-base italic text-gray-700">"${story.testimonial}"</p>
                    <p class="text-sm text-gray-500 mt-2">- ${story.name}</p>
                </div>
                ` : ''}
                
                ${story.outcome ? `
                <div class="bg-green-50 rounded-lg p-3 flex items-center">
                    <svg class="w-5 h-5 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    <div>
                        <p class="font-semibold text-green-800 text-sm">Outcome: ${story.outcome}</p>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    return card;
}

/**
 * Get story type information (label and icon)
 */
function getStoryTypeInfo(type) {
    const types = {
        patient: {
            label: 'Patient Story',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path></svg>'
        },
        donor: {
            label: 'Donor Story',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>'
        },
        emergency: {
            label: 'Emergency Response',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
        }
    };
    return types[type] || types.patient;
}

/**
 * Get story-specific metrics
 */
function getStoryMetrics(story) {
    let metrics = '';

    if (story.type === 'donor') {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    <strong>${story.donationCount}+</strong>&nbsp;Donations
                </div>
                <div class="flex items-center text-accent bg-accent-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    <strong>${story.yearsActive}</strong>&nbsp;Years
                </div>
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.donationType}
                </div>
            </div>
        `;
    } else if (story.type === 'emergency') {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                <div class="flex items-center text-warning bg-orange-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.responseTime}
                </div>
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"></path>
                    </svg>
                    ${story.donorsMobilized} Donors
                </div>
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.unitsFulfilled}/${story.unitsRequired} Units
                </div>
            </div>
        `;
    } else {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                ${story.unitsRequired ? `
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.unitsRequired} Units
                </div>
                ` : ''}
                <div class="flex items-center text-accent bg-accent-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.location}
                </div>
                ${story.hospital ? `
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.hospital}
                </div>
                ` : ''}
            </div>
        `;
    }

    return metrics;
}

/**
 * Update statistics
 */
function updateStats(stats) {
    const statElements = {
        totalStories: document.getElementById('totalStories'),
        totalDonors: document.getElementById('totalDonors'),
        totalPatients: document.getElementById('totalPatients')
    };

    if (statElements.totalStories) statElements.totalStories.textContent = stats.totalStories;
    if (statElements.totalDonors) statElements.totalDonors.textContent = stats.totalDonors;
    if (statElements.totalPatients) statElements.totalPatients.textContent = stats.totalPatients;
}

/**
 * Format date to readable format
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Show error message
 */
function showError(message) {
    const storiesGrid = document.getElementById('storiesGrid');
    if (storiesGrid) {
        storiesGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl text-gray-700 mb-2">Oops! Something went wrong</p>
                <p class="text-gray-500">${message}</p>
            </div>
        `;
    }
}
