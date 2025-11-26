// Emergency Statistics Common Module
// This file contains shared functionality for loading and updating emergency statistics
// Used across multiple pages: index.html, emergency_request_system.html, etc.

// API Configuration
const EMERGENCY_API_URL = 'https://script.google.com/macros/s/AKfycbxojezkE43grgB_qBBTHXaP4YPYnNRoF8OML5edqL5hixtDbDRZuVWV553hFN2BoDXsuA/exec';

/**
 * Load emergency statistics from the API
 * @returns {Promise<Object>} Statistics data or fallback values
 */
async function loadEmergencyStatistics() {
    try {
        const response = await fetch(EMERGENCY_API_URL, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        const data = await response.json();

        if (data.success && data.statistics) {
            return data.statistics;
        } else {
            // Fallback to default values if no data is available
            return { total: 0, open: 0, verified: 0, closed: 0 };
        }
    } catch (error) {
        console.error('❌ Error loading emergency statistics:', error);
        // Fallback to default values on error
        return { total: 0, open: 0, verified: 0, closed: 0 };
    }
}

/**
 * Update statistics in the DOM based on request data
 * @param {Array} requests - Array of emergency requests (optional)
 * @param {Object} statistics - Statistics object from API (optional)
 * @param {Map} buttonStates - Button states map (optional, for backward compatibility)
 */
function updateStatistics(requests = [], statistics = null, buttonStates = new Map()) {
    let openRequests, successRate, livesSaved;

    if (statistics) {
        // Use statistics from Google Apps Script (more accurate)
        openRequests = statistics.open + statistics.verified;
        const totalRequests = statistics.total;
        const verifiedRequests = statistics.verified;
        const closedRequests = statistics.closed;

        successRate = totalRequests > 0 ? Math.round((closedRequests / totalRequests) * 100) : 94;
        livesSaved = closedRequests; // Show actual closed count as lives saved
    } else {
        // Fallback to local calculation (for backward compatibility)
        openRequests = requests.filter(request => {
            const cardKey = `${request.patientName}-${request.bloodType}`;
            const storedState = buttonStates.get(cardKey);
            return !storedState || storedState.closeStatus !== 'closed';
        }).length;

        const totalRequests = requests.length;
        const verifiedRequests = requests.filter(request => {
            const cardKey = `${request.patientName}-${request.bloodType}`;
            const storedState = buttonStates.get(cardKey);
            return storedState && storedState.verifyStatus === 'verified';
        }).length;

        successRate = totalRequests > 0 ? Math.round((verifiedRequests / totalRequests) * 100) : 94;

        const closedRequests = requests.filter(request => {
            const cardKey = `${request.patientName}-${request.bloodType}`;
            const storedState = buttonStates.get(cardKey);
            return storedState && storedState.closeStatus === 'closed';
        }).length;
        livesSaved = closedRequests * 3;
    }

    // Update the DOM elements
    const openRequestsElement = document.getElementById('openRequests');
    const successRateElement = document.getElementById('successRate');
    const livesSavedElement = document.getElementById('livesSaved');
    const activeRequestsNumberElement = document.getElementById('activeRequestsNumber');

    if (openRequestsElement) {
        openRequestsElement.textContent = openRequests;
    }
    if (successRateElement) {
        successRateElement.textContent = successRate + '%';
    }
    if (livesSavedElement) {
        livesSavedElement.textContent = livesSaved;
    }
    if (activeRequestsNumberElement) {
        activeRequestsNumberElement.textContent = openRequests;
    }
}

/**
 * Initialize emergency statistics for a page
 * This function should be called on page load to automatically load and display statistics
 */
async function initializeEmergencyStatistics() {
    try {
        const statistics = await loadEmergencyStatistics();
        updateStatistics([], statistics);
    } catch (error) {
        console.error('❌ Error initializing emergency statistics:', error);
        // Fallback to default values
        updateStatistics([], { total: 0, open: 0, verified: 0, closed: 0 });
    }
}

/**
 * Refresh emergency statistics (useful for refresh buttons)
 * @returns {Promise<Object>} Updated statistics
 */
async function refreshEmergencyStatistics() {
    try {
        const statistics = await loadEmergencyStatistics();
        updateStatistics([], statistics);
        return statistics;
    } catch (error) {
        console.error('❌ Error refreshing emergency statistics:', error);
        // Fallback to default values
        const fallbackStats = { total: 0, open: 0, verified: 0, closed: 0 };
        updateStatistics([], fallbackStats);
        return fallbackStats;
    }
}

// Export functions for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadEmergencyStatistics,
        updateStatistics,
        initializeEmergencyStatistics,
        refreshEmergencyStatistics,
        EMERGENCY_API_URL
    };
}

// Auto-initialize when DOM is ready (for direct script inclusion)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEmergencyStatistics);
} else {
    // DOM is already ready
    initializeEmergencyStatistics();
}
