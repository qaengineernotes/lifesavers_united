/**
 * Featured Stories Loader
 * Dynamically loads and displays featured stories from stories.json
 */

document.addEventListener('DOMContentLoaded', async function () {
    const storiesContainer = document.getElementById('featured-stories-container');

    if (!storiesContainer) {
        return; // Exit if container doesn't exist on this page
    }

    try {
        // Fetch stories from JSON file
        const response = await fetch('/data/stories.json');
        if (!response.ok) {
            throw new Error('Failed to load stories');
        }

        const data = await response.json();
        const stories = data.stories || [];

        // Get the first 3 stories (not the most recent, but the first ones in the array)
        const featuredStories = stories.slice(0, 3);

        if (featuredStories.length === 0) {
            storiesContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">No featured stories available at this time.</p>';
            return;
        }

        // Clear the container
        storiesContainer.innerHTML = '';

        // Render each featured story
        featuredStories.forEach((story, index) => {
            const storyCard = createStoryCard(story, index);
            storiesContainer.appendChild(storyCard);
        });

    } catch (error) {
        console.error('Error loading stories:', error);
        storiesContainer.innerHTML = '<p class="text-center text-text-secondary col-span-full">Unable to load stories at this time.</p>';
    }
});

/**
 * Creates a story card element
 * @param {Object} story - Story data object
 * @param {number} index - Story index for positioning
 * @returns {HTMLElement} Story card element
 */
function createStoryCard(story, index) {
    const card = document.createElement('div');
    card.className = 'card hover:shadow-lg transition-smooth';
    card.setAttribute('itemprop', 'itemListElement');
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/ListItem');

    // Determine badge color and text based on story type
    const badgeConfig = getBadgeConfig(story.type);

    // Format the date
    const formattedDate = formatDate(story.date);

    // Create the card HTML
    card.innerHTML = `
        <meta itemprop="position" content="${index + 1}">
        <img src="${story.image}" 
            alt="${story.title}" 
            class="w-full h-48 object-cover rounded-lg mb-4" 
            style="object-position: center 20%;"
            loading="lazy"
            onerror="this.src='/imgs/default-story.jpg'; this.onerror=null;" 
            itemprop="image" />
        <div class="flex items-center mb-3">
            <div class="bg-${badgeConfig.color} w-3 h-3 rounded-full mr-2"></div>
            <span class="text-sm text-${badgeConfig.color} font-semibold">${badgeConfig.text}</span>
        </div>
        <h3 class="text-xl font-semibold mb-3" itemprop="name">${story.title}</h3>
        <p class="text-text-secondary mb-4" itemprop="description">
            ${story.excerpt}
        </p>
        <div class="flex items-center justify-between">
            <span class="text-sm text-text-secondary">${formattedDate}</span>
            ${story.donationCount ? `<span class="text-sm text-primary font-semibold">${story.donationCount} Donations</span>` : ''}
        </div>
    `;

    return card;
}

/**
 * Gets badge configuration based on story type
 * @param {string} type - Story type
 * @returns {Object} Badge configuration
 */
function getBadgeConfig(type) {
    const configs = {
        'donor': { color: 'primary', text: 'Donor Hero' },
        'recipient': { color: 'accent', text: 'Recovery Success' },
        'emergency': { color: 'warning', text: 'Emergency Response' },
        'default': { color: 'secondary', text: 'Success Story' }
    };

    return configs[type] || configs.default;
}

/**
 * Formats a date string to a relative time or formatted date
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
}
