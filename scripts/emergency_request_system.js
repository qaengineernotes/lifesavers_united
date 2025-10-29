﻿// Local proxy URL to avoid CORS issues
const FETCH_URL = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec';
let isButtonActionInProgress = false; // Flag to prevent refresh during button actions

// Emergency request system script loaded

// Test function to check if Google Apps Script is accessible
async function testGoogleAppsScript() {
    try {
        const response = await fetch(FETCH_URL);

        if (response.ok) {
            const data = await response.json();
            return true;
        } else {
            console.error('❌ Response not OK:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing Google Apps Script:', error);
        return false;
    }
}


// Override the remove function to prevent card removal when button action is in progress
const originalRemove = Element.prototype.remove;
Element.prototype.remove = function () {
    if (this.classList && this.classList.contains('emergency-request-card') && isButtonActionInProgress) {
        return; // Block card removal when button action is in progress
    }
    return originalRemove.call(this);
};
let buttonStates = new Map(); // Store button states locally

// Emergency system functionality
document.addEventListener('DOMContentLoaded', function () {
    // Load emergency requests directly (bypass test for now)
    loadEmergencyRequests();

    // Add event listeners for verify and close buttons
    document.addEventListener('click', function (e) {
        if (e.target.closest('.verify-btn')) {
            const button = e.target.closest('.verify-btn');
            // Only allow clicking if button is not disabled
            if (!button.disabled) {
                isButtonActionInProgress = true; // Set flag to prevent refresh
                const patientName = button.getAttribute('data-patient-name');
                const bloodType = button.getAttribute('data-blood-type');
                verifyRequest(patientName, bloodType, button);
            }
        }

        if (e.target.closest('.close-btn')) {
            const button = e.target.closest('.close-btn');

            // Only allow clicking if button is not disabled
            if (!button.disabled) {
                isButtonActionInProgress = true; // Set flag to prevent refresh
                const patientName = button.getAttribute('data-patient-name');
                const bloodType = button.getAttribute('data-blood-type');
                closeRequest(patientName, bloodType, button);
            }
        }

        if (e.target.closest('.refresh-btn')) {
            // Don't refresh if a button action is in progress
            if (isButtonActionInProgress) {
                return;
            }

            const refreshBtn = e.target.closest('.refresh-btn');

            // Add loading state to refresh button
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-1 inline animate-spin" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd"
                                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                clip-rule="evenodd" />
                        </svg>
                        Refreshing...
                    `;
            refreshBtn.disabled = true;

            // Load emergency requests
            loadEmergencyRequests().finally(() => {
                // Restore button state after loading completes
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            });
        }
        if (e.target.closest('.share-btn')) {
            const shareBtn = e.target.closest('.share-btn');
            const requestData = JSON.parse(shareBtn.getAttribute('data-request-data'));
            showShareOptions(requestData);
        }
    });



    // Form validation for hospital requests
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Basic validation
            const requiredFields = form.querySelectorAll('select, input[required], textarea[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.classList.add('border-error');
                    isValid = false;
                } else {
                    field.classList.remove('border-error');
                }
            });

            if (isValid) {
                // Show success message
                alert('Emergency request submitted successfully! Donors will be notified immediately.');
                form.reset();
            } else {
                alert('Please fill in all required fields.');
            }
        });
    }
});

// Function to load emergency requests from Google Sheets
async function loadEmergencyRequests() {


    // Only prevent refresh if button action is in progress AND we already have cards
    // For initial load, always proceed
    if (isButtonActionInProgress && document.querySelectorAll('.emergency-request-card').length > 0) {

        return;
    }

    const container = document.getElementById('emergencyRequestsContainer');
    const loadingState = document.getElementById('loadingState');
    const noRequestsState = document.getElementById('noRequestsState');



    if (!container || !loadingState || !noRequestsState) {
        console.error('❌ Required DOM elements not found');
        return;
    }

    try {
        // Show loading state
        loadingState.classList.remove('hidden');
        noRequestsState.classList.add('hidden');

        // Clear existing requests (but not if button action is in progress)
        if (!isButtonActionInProgress) {
            const existingRequests = container.querySelectorAll('.emergency-request-card');
            existingRequests.forEach(card => card.remove());
        } else {
            return; // Don't proceed with the rest of the function
        }

        // Fetch data from Google Apps Script

        const response = await fetch(FETCH_URL, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });



        const data = await response.json();

        if (data.success && data.requests && data.requests.length > 0) {

            // Hide loading and no requests states
            loadingState.classList.add('hidden');
            noRequestsState.classList.add('hidden');

            // Calculate and update statistics
            updateStatistics(data.requests, data.statistics);

            // Display each request and initialize button states
            data.requests.forEach((request, index) => {
                const requestCard = createRequestCard(request);
                container.appendChild(requestCard);

                // Initialize button states based on request status
                const cardKey = `${request.patientName}-${request.bloodType}`;
                const requestStatus = request.status || 'Open';

                if (requestStatus === 'Verified') {
                    buttonStates.set(cardKey, { verifyStatus: 'verified' });
                } else if (requestStatus === 'Closed') {
                    buttonStates.set(cardKey, { closeStatus: 'closed' });
                }
            });
        } else {
            // Show no requests state
            loadingState.classList.add('hidden');
            noRequestsState.classList.remove('hidden');

            // Update statistics with empty data
            updateStatistics([], { total: 0, open: 0, verified: 0, closed: 0 });
        }

    } catch (error) {
        console.error('❌ Error loading emergency requests:', error);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        loadingState.classList.add('hidden');
        noRequestsState.classList.remove('hidden');
        noRequestsState.innerHTML = `
                    <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <h3 class="text-xl font-semibold text-text-primary mb-2">Error Loading Requests</h3>
                    <p class="text-text-secondary">Unable to load emergency requests. Please try again later.</p>
                    <p class="text-sm text-red-500 mt-2">Error: ${error.message}</p>
                `;
    }
}

// Function to create a request card
// Function to create a request card
function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'emergency-request-card bg-white rounded-2xl p-6 shadow-card border-l-4';

    // Determine urgency level and styling
    const urgencyLevel = getUrgencyLevel(request);
    const urgencyConfig = getUrgencyConfig(urgencyLevel);

    card.classList.add(urgencyConfig.borderColor);

    // Calculate time since request
    const timeSince = calculateTimeSince(request.inquiryDate);

    // Check stored button states and request status
    const cardKey = `${request.patientName}-${request.bloodType}`;
    const storedState = buttonStates.get(cardKey);
    const requestStatus = request.status || 'Open';

    // Determine button states based on request status and stored state
    let verifyButtonClass = 'btn-verify btn-flex verify-btn';
    let verifyButtonText = 'Verify';
    let verifyButtonDisabled = '';
    let closeButtonClass = 'btn-close btn-flex close-btn';
    let closeButtonText = 'Close';
    let closeButtonDisabled = '';

    // Check if request is already verified based on status or stored state
    if (requestStatus === 'Verified' || (storedState && storedState.verifyStatus === 'verified')) {
        verifyButtonClass = 'btn-verified btn-flex verify-btn';
        verifyButtonText = 'Verified';
        verifyButtonDisabled = 'disabled';
    }

    // Check if request is already closed based on status or stored state
    if (requestStatus === 'Closed' || (storedState && storedState.closeStatus === 'closed')) {
        closeButtonClass = 'btn-closed btn-flex close-btn';
        closeButtonText = 'Closed';
        closeButtonDisabled = 'disabled';
    }

    // Format patient age display
    const patientAge = request.patientAge ? `, ${request.patientAge} years` : '';

    card.innerHTML = `
    <style>
        @media (max-width: 639px) {
            .emergency-request-card .mobile-header {
                flex-direction: column !important;
                gap: 12px !important;
            }
            .emergency-request-card .mobile-icon-container {
                align-items: flex-start !important;
            }
            .emergency-request-card .mobile-icon {
                padding: 8px !important;
                margin-right: 12px !important;
                flex-shrink: 0 !important;
            }
            .emergency-request-card .mobile-icon svg {
                width: 20px !important;
                height: 20px !important;
            }
            .emergency-request-card .mobile-text-container {
                min-width: 0 !important;
                flex: 1 !important;
            }
            .emergency-request-card .mobile-title {
                font-size: 1.125rem !important;
                line-height: 1.25 !important;
            }
            .emergency-request-card .mobile-subtitle {
                font-size: 0.875rem !important;
            }
            .emergency-request-card .mobile-subtitle.patient {
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            .emergency-request-card .mobile-subtitle.hospital {
                word-wrap: break-word !important;
            }
            .emergency-request-card .mobile-badge {
                padding: 4px 8px !important;
                font-size: 0.75rem !important;
                align-self: flex-start !important;
                white-space: nowrap !important;
            }
            .emergency-request-card .mobile-grid {
                grid-template-columns: 1fr !important;
                gap: 12px !important;
            }
            .emergency-request-card .mobile-grid-item {
                display: flex !important;
                justify-content: space-between !important;
            }
            .emergency-request-card .mobile-grid-value {
                font-size: 1rem !important;
            }
            .emergency-request-card .mobile-grid-value.contact {
                word-break: break-all !important;
            }
            .emergency-request-card .mobile-buttons {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            }
            .emergency-request-card .mobile-button {
                width: 100% !important;
            }
            .emergency-request-card .mobile-button svg {
                width: 16px !important;
                height: 16px !important;
                flex-shrink: 0 !important;
            }
            .emergency-request-card .mobile-button span {
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            .emergency-request-card .mobile-copy-container {
                flex-direction: row !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .emergency-request-card .mobile-copy-btn {
                padding: 6px !important;
            }
            .emergency-request-card .mobile-copy-btn svg {
                width: 18px !important;
                height: 18px !important;
            }
        }
    </style>

    <div class="flex items-start justify-between mb-4 mobile-header">
        <div class="flex items-center mobile-icon-container">
            <div class="${urgencyConfig.iconBg} p-3 rounded-full mr-4 mobile-icon">
                <svg class="w-6 h-6 ${urgencyConfig.iconColor}" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="${urgencyConfig.iconPath}" clip-rule="evenodd" />
                </svg>
            </div>
            <div class="mobile-text-container">
                <h3 class="text-xl font-bold ${urgencyConfig.textColor} mobile-title">${request.bloodType} Blood Needed</h3>
                <p class="text-text-secondary mobile-subtitle patient">Patient: ${request.patientName}${patientAge}</p>
                <p class="text-text-secondary mobile-subtitle hospital">${request.hospitalName}${request.diagnosis ? ` - ${request.diagnosis}` : ''}</p>
            </div>
        </div>
        <div class="flex items-center space-x-2 mobile-q-container">
            <button class="share-btn p-2 rounded-full hover:bg-gray-100 transition-colors mobile-copy-btn" data-request-data='${JSON.stringify(request)}' title="Share request details">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                </svg>
            </button>
            <span class="${urgencyConfig.badgeBg} text-white px-3 py-1 rounded-full text-sm font-semibold mobile-badge">${urgencyConfig.badgeText}</span>
        </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-4 mobile-grid">
        <div class="mobile-grid-item">
            <span class="text-sm text-text-secondary">Blood Type</span>
            <p class="font-bold text-lg mobile-grid-value">${request.bloodType}</p>
        </div>
        <div class="mobile-grid-item">
            <span class="text-sm text-text-secondary">Quantity Needed</span>
            <p class="font-bold text-lg mobile-grid-value">${request.unitsRequired} Units</p>
        </div>
        <div class="mobile-grid-item">
            <span class="text-sm text-text-secondary">Time Since Request</span>
            <p class="font-bold text-lg ${urgencyConfig.timeColor} mobile-grid-value">${timeSince}</p>
        </div>
        <div class="mobile-grid-item">
            <span class="text-sm text-text-secondary">Contact</span>
            <p class="font-bold text-lg mobile-grid-value contact">${request.contactNumber}</p>
        </div>
    </div>

    <div class="btn-container mobile-buttons">
        <button class="${verifyButtonClass} mobile-button" data-patient-name="${request.patientName}" data-blood-type="${request.bloodType}" ${verifyButtonDisabled}>
            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            <span>${verifyButtonText}</span>
        </button>
        <button class="${closeButtonClass} mobile-button" data-patient-name="${request.patientName}" data-blood-type="${request.bloodType}" ${closeButtonDisabled}>
            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </path>
            </svg>
            <span>${closeButtonText}</span>
        </button>
    </div>
`;

    return card;
}

// Function to determine urgency level
function getUrgencyLevel(request) {
    // Use the urgencyLevel field from the request
    const urgency = request.urgency;

    // If urgencyLevel is blank, null, undefined, or "Normal", return 'normal'
    if (!urgency || urgency.toLowerCase() === 'normal') {
        return 'normal';
    }

    // If urgencyLevel is "Urgent", return 'urgent'
    if (urgency.toLowerCase() === 'urgent') {
        return 'urgent';
    }

    // If urgencyLevel is "Critical", return 'critical'
    if (urgency.toLowerCase() === 'critical') {
        return 'critical';
    }

    // Default to 'normal' for any other values
    return 'normal';
}

// Function to get urgency configuration
function getUrgencyConfig(level) {
    const configs = {
        critical: {
            borderColor: 'border-error',
            iconBg: 'bg-error-100',
            iconColor: 'text-error',
            textColor: 'text-error',
            badgeBg: 'bg-error',
            badgeText: 'CRITICAL',
            timeColor: 'text-error',
            progressColor: 'bg-error',
            title: 'CRITICAL',
            iconPath: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
        },
        urgent: {
            borderColor: 'border-warning',
            iconBg: 'bg-warning-100',
            iconColor: 'text-warning',
            textColor: 'text-warning',
            badgeBg: 'bg-warning',
            badgeText: 'URGENT',
            timeColor: 'text-warning',
            progressColor: 'bg-warning',
            title: 'URGENT',
            iconPath: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
        },
        high: {
            borderColor: 'border-warning',
            iconBg: 'bg-warning-100',
            iconColor: 'text-warning',
            textColor: 'text-warning',
            badgeBg: 'bg-warning',
            badgeText: 'HIGH',
            timeColor: 'text-warning',
            progressColor: 'bg-accent',
            title: 'HIGH PRIORITY',
            iconPath: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
        },
        normal: {
            borderColor: 'border-accent',
            iconBg: 'bg-accent-100',
            iconColor: 'text-accent',
            textColor: 'text-accent',
            badgeBg: 'bg-accent',
            badgeText: 'NORMAL',
            timeColor: 'text-accent',
            progressColor: 'bg-accent',
            title: 'BLOOD NEEDED',
            iconPath: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
        }
    };

    return configs[level] || configs.normal;
}



// Function to calculate time since request
function calculateTimeSince(inquiryDate) {
    const now = new Date();
    let requestDate;

    // Handle different date formats
    if (typeof inquiryDate === 'string') {
        // Try to parse the date string
        requestDate = new Date(inquiryDate);

        // Check if the date is valid
        if (isNaN(requestDate.getTime())) {
            // If parsing fails, try to handle common formats
            const dateParts = inquiryDate.split(/[\/\-]/);
            if (dateParts.length >= 3) {
                // Try different date formats
                requestDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]); // DD/MM/YYYY
                if (isNaN(requestDate.getTime())) {
                    requestDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); // YYYY/MM/DD
                }
            }
        }
    } else {
        requestDate = new Date(inquiryDate);
    }

    // If still invalid, return "Unknown"
    if (isNaN(requestDate.getTime())) {
        return "Unknown";
    }

    const diffMs = now - requestDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 1) {
        return `${diffMinutes} minutes`;
    } else if (diffHours < 24) {
        return `${diffHours} hours`;
    } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days`;
    }
}

// Function to handle "Verified" button click
async function verifyRequest(patientName, bloodType, button) {
    // Show custom verification popup
    const confirmed = await showVerificationPopup(patientName, bloodType);
    if (!confirmed) {
        return; // User cancelled the verification
    }

    if (true) { // Always proceed if user confirmed
        try {
            // Show loading state
            button.disabled = true;
            button.innerHTML = `
                        <svg class="w-5 h-5 mr-2 inline animate-spin" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                        </svg>
                        Updating...
                    `;

            // Prepare the data for the API call
            const requestData = {
                patientName: patientName,
                bloodType: bloodType,
                status: 'Verified'
            };

            // Call the Google Apps Script directly
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec';

            // Create URL-encoded form data
            const formData = new URLSearchParams();
            formData.append('action', 'update_status');
            formData.append('data', JSON.stringify(requestData));



            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
                redirect: 'follow'
            });



            const result = await response.json();

            if (result.success) {
                // Store reference to the card
                const card = button.closest('.emergency-request-card');

                // Change button appearance to show verified status
                button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                            Verified
                        `;
                button.classList.remove('btn-verify');
                button.classList.add('btn-verified');
                // button.disabled = true;



                // Store the button state locally
                const cardKey = `${patientName}-${bloodType}`;
                const existingState = buttonStates.get(cardKey) || {};
                const newState = {
                    ...existingState,
                    verifyStatus: 'verified'
                };
                buttonStates.set(cardKey, newState);

                // Statistics will be updated when the page refreshes or new data is loaded
                // No need to update statistics here as it may cause incorrect calculations

                // Show success message
                showSuccessMessage('Request marked as VERIFIED successfully!');

                // Keep the card visible and don't refresh automatically
                // The button state change is sufficient to show the action was completed

                // Reset the flag to allow refresh button to work
                isButtonActionInProgress = false;
            } else {
                // Reset button state on error
                button.disabled = false;
                button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                            Verify
                        `;
                button.classList.remove('btn-verified');
                button.classList.add('btn-verify');
                showSuccessMessage('Failed to update status. Please try again.');
                isButtonActionInProgress = false; // Reset flag on error
            }
        } catch (error) {
            console.error('Error updating status:', error);

            // Reset button state on error
            button.disabled = false;
            button.innerHTML = `
                        <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        Verify
                    `;
            button.classList.remove('btn-verified');
            button.classList.add('btn-verify');
            showSuccessMessage('Error updating status. Please try again.');
            isButtonActionInProgress = false; // Reset flag on error
        }
    }
}

// Function to handle "Closed" button click
async function closeRequest(patientName, bloodType, button) {
    // Check authorization first
    const isAuthorized = await checkAuthorization();

    if (!isAuthorized) {
        return; // User is not authorized
    }

    // Show custom popup for donor information
    const donorInfo = await showDonorInfoPopup(patientName, bloodType);
    if (!donorInfo) {
        return; // User cancelled the popup
    }

    try {
        // Show loading state
        button.disabled = true;
        button.innerHTML = `
                    <svg class="w-5 h-5 mr-2 inline animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    Updating...
                `;

        // Prepare the data for the API call
        const requestData = {
            patientName: patientName,
            bloodType: bloodType,
            status: 'Closed',
            donorInfo: donorInfo
        };

        // Call the Google Apps Script directly
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec';

        // Create URL-encoded form data
        const formData = new URLSearchParams();
        formData.append('action', 'update_status');
        formData.append('data', JSON.stringify(requestData));



        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            redirect: 'follow'
        });



        const result = await response.json();

        if (result.success) {
            // If donor details were collected, save them to a different sheet
            // Only save to Form Responses 2 if it's an actual donor (not Relative or Other)
            if (donorInfo && donorInfo !== 'Relative' && !donorInfo.includes('Other')) {
                await saveDonorDetailsToSheet(patientName, bloodType, donorInfo);
            }

            // Store reference to the card
            const card = button.closest('.emergency-request-card');

            // Change button appearance to show closed status
            button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                            Closed
                        `;
            button.classList.remove('btn-close');
            button.classList.add('btn-closed');
            button.disabled = true;



            // Store the button state locally
            const cardKey = `${patientName}-${bloodType}`;
            const existingState = buttonStates.get(cardKey) || {};
            const newState = {
                ...existingState,
                closeStatus: 'closed'
            };
            buttonStates.set(cardKey, newState);

            // Statistics will be updated when the page refreshes or new data is loaded
            // No need to update statistics here as it may cause incorrect calculations

            // Show success message
            showSuccessMessage('Request marked as CLOSED successfully!');

            // Keep the card visible and don't refresh automatically
            // The button state change is sufficient to show the action was completed

            // Reset the flag to allow refresh button to work
            isButtonActionInProgress = false;
        } else {
            // Reset button state on error
            button.disabled = false;
            button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                            Close
                        `;
            button.classList.remove('btn-closed');
            button.classList.add('btn-close');
            showSuccessMessage('Failed to update status. Please try again.');
            isButtonActionInProgress = false; // Reset flag on error
        }
    } catch (error) {
        console.error('Error updating status:', error);

        // Reset button state on error
        button.disabled = false;
        button.innerHTML = `
                        <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        Close
                    `;
        button.classList.remove('btn-closed');
        button.classList.add('btn-close');
        showSuccessMessage('Error updating status. Please try again.');
        isButtonActionInProgress = false; // Reset flag on error
    }
}

// updateStatistics function is now imported from emergency-statistics.js

// Function to show success message without using alert
function showSuccessMessage(message) {
    // Create a temporary success message element
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10B981;
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                z-index: 9999;
                font-weight: 600;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease-out;
            `;
    successDiv.textContent = message;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
    document.head.appendChild(style);

    document.body.appendChild(successDiv);

    // Remove the message after 3 seconds
    setTimeout(() => {
        successDiv.remove();
        style.remove();
    }, 3000);
}

// Function to check user authorization
async function checkAuthorization() {


    // Check if user has access via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const hasAccess = urlParams.get('closeAccess');


    if (hasAccess === 'true') {

        return true; // User has access via URL
    }

    // Show custom password popup

    return new Promise((resolve) => {
        // Create modal overlay with explicit inline styles
        const modal = document.createElement('div');
        modal.id = 'passwordModal';

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        // Create modal content with explicit inline styles
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            position: relative;
            z-index: 1000000;
        `;
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; background-color: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg style="width: 32px; height: 32px; color: #d97706;" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                    </svg>
                </div>
                <h3 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Authorization Required</h3>
                <p style="color: #6b7280;">Enter password to close blood requests</p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Password *</label>
                <input type="password" id="authPassword" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; box-sizing: border-box;" placeholder="Enter your password" required>
                <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">This action requires proper authorization</p>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="cancelAuthBtn" style="flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; font-weight: 500; background-color: white; cursor: pointer; transition: all 0.2s ease;">
                    Cancel
                </button>
                <button id="submitAuthBtn" style="flex: 1; padding: 12px 16px; background-color: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                    Authorize
                </button>
            </div>
        `;

        // Add event listeners
        const cancelBtn = modalContent.querySelector('#cancelAuthBtn');
        const submitBtn = modalContent.querySelector('#submitAuthBtn');
        const passwordInput = modalContent.querySelector('#authPassword');

        // Add hover effects
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#f3f4f6';
            cancelBtn.style.borderColor = '#9ca3af';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = 'white';
            cancelBtn.style.borderColor = '#d1d5db';
        });

        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.backgroundColor = '#b91c1c';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.backgroundColor = '#dc2626';
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });

        // Handle submit
        submitBtn.addEventListener('click', () => {
            const password = passwordInput.value.trim();
            if (!password) {
                passwordInput.style.borderColor = '#ef4444';
                passwordInput.focus();
                return;
            }

            // Simple password check (you can make this more secure)
            // For production, this should be server-side validation
            const validPasswords = ['admin123', 'lifesaver2025', 'emergency']; // Add your passwords here

            if (validPasswords.includes(password)) {
                modal.remove();
                resolve(true);
            } else {
                passwordInput.style.borderColor = '#ef4444';
                passwordInput.value = '';
                passwordInput.focus();

                // Show error message
                const errorMsg = modalContent.querySelector('.error-message') || document.createElement('p');
                errorMsg.style.cssText = 'color: #ef4444; font-size: 14px; margin-top: 8px; text-align: center;';
                errorMsg.textContent = 'Invalid password. Please try again.';
                errorMsg.className = 'error-message';

                if (!modalContent.querySelector('.error-message')) {
                    modalContent.insertBefore(errorMsg, modalContent.querySelector('div:last-child'));
                }
            }
        });

        // Handle Enter key
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });

        // Add modal content to modal
        modal.appendChild(modalContent);


        // Focus on password input
        passwordInput.focus();

        // Add modal to page

        document.body.appendChild(modal);

    });
}

// Function to show custom verification popup
function showVerificationPopup(patientName, bloodType) {
    return new Promise((resolve) => {
        // Create modal overlay with explicit inline styles
        const modal = document.createElement('div');
        modal.id = 'verificationModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        // Create modal content with explicit inline styles
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            position: relative;
            z-index: 1000000;
        `;
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg style="width: 32px; height: 32px; color: #2563eb;" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </div>
                <h3 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Verify Blood Request</h3>
                <p style="color: #6b7280;">Patient: ${patientName} | Blood Type: ${bloodType}</p>
            </div>
            
            <div style="margin-bottom: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
                <p style="font-size: 16px; color: #374151; text-align: center; margin: 0;">
                    Are you sure you want to mark this blood request as <strong>VERIFIED</strong>?
                </p>
                <p style="font-size: 14px; color: #6b7280; text-align: center; margin: 8px 0 0 0;">
                    This action will confirm that the blood request has been verified and is legitimate.
                </p>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="cancelVerifyBtn" style="flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; font-weight: 500; background-color: white; cursor: pointer; transition: all 0.2s ease;">
                    Cancel
                </button>
                <button id="confirmVerifyBtn" style="flex: 1; padding: 12px 16px; background-color: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                    Verify Request
                </button>
            </div>
        `;

        // Add event listeners
        const cancelBtn = modalContent.querySelector('#cancelVerifyBtn');
        const confirmBtn = modalContent.querySelector('#confirmVerifyBtn');

        // Add hover effects
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#f3f4f6';
            cancelBtn.style.borderColor = '#9ca3af';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = 'white';
            cancelBtn.style.borderColor = '#d1d5db';
        });

        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.backgroundColor = '#1d4ed8';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.backgroundColor = '#2563eb';
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });

        // Handle confirm
        confirmBtn.addEventListener('click', () => {
            modal.remove();
            resolve(true);
        });

        // Handle clicking outside modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        });

        // Handle escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                resolve(false);
                document.removeEventListener('keydown', escapeHandler);
            }
        });

        // Add modal content to modal
        modal.appendChild(modalContent);

        // Add modal to page
        document.body.appendChild(modal);

        // Focus on confirm button initially
        setTimeout(() => {
            confirmBtn.focus();
        }, 100);
    });
}

// Function to show custom popup for donor information
function showDonorInfoPopup(patientName, bloodType) {
    return new Promise((resolve) => {
        // Create modal overlay with explicit inline styles
        const modal = document.createElement('div');
        modal.id = 'donorInfoModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        // Create modal content with explicit inline styles
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 480px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            position: relative;
            z-index: 1000000;
        `;
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Close Blood Request</h3>
                <p style="color: #6b7280;">Patient: ${patientName} | Blood Type: ${bloodType}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <p style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 16px;">Who has donated the blood?</p>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 12px;">
                        <input type="radio" name="donorType" value="relative" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span style="color: #374151; font-weight: 500;">Relative</span>
                    </label>
                    
                    <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 12px;">
                        <input type="radio" name="donorType" value="donor" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span style="color: #374151; font-weight: 500;">Donor</span>
                    </label>
                    
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="donorType" value="noDonation" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span style="color: #374151; font-weight: 500;">Other</span>
                        <div style="position: relative; margin-left: 8px;">
                            <svg class="info-icon" style="width: 16px; height: 16px; color: #6b7280; cursor: help;" fill="currentColor" viewBox="0 0 20 20" onmouseenter="this.parentElement.querySelector('.tooltip').style.opacity='1'; this.parentElement.querySelector('.tooltip').style.visibility='visible';" onmouseleave="this.parentElement.querySelector('.tooltip').style.opacity='0'; this.parentElement.querySelector('.tooltip').style.visibility='hidden';">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                            </svg>
                            <div class="tooltip" style="position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; padding: 8px 12px; background-color: #1f2937; color: white; border-radius: 6px; font-size: 12px; white-space: normal; width: 350px; text-align: left; opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s; z-index: 1000001; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                • Patient died<br>
                                • Discharged<br>
                                • Condition improved<br>
                                • Transferred<br>
                                • Medical reasons
                                <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #1f2937;"></div>
                            </div>
                        </div>
                    </label>
                </div>
            </div>
            
            <div id="donorDetailsSection" style="display: none; margin-bottom: 24px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Donor Name *</label>
                    <input type="text" id="donorName" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px;" placeholder="Enter donor name" required>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">This field is required when selecting 'Donor'</p>
                </div>
                <div>
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Contact Info (Optional)</label>
                    <input type="text" id="donorContact" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px;" placeholder="Phone number or email">
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Phone number or email address</p>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="cancelBtn" style="flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; font-weight: 500; background-color: white; cursor: pointer;">
                    Cancel
                </button>
                <button id="submitBtn" style="flex: 1; padding: 12px 16px; background-color: #dc2626; color: white; border-radius: 8px; font-weight: 500; cursor: pointer; opacity: 0.5;" disabled>
                    Close Request
                </button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Get elements
        const donorTypeRadios = modal.querySelectorAll('input[name="donorType"]');
        const donorDetailsSection = modal.querySelector('#donorDetailsSection');
        const donorNameInput = modal.querySelector('#donorName');
        const donorContactInput = modal.querySelector('#donorContact');
        const submitBtn = modal.querySelector('#submitBtn');
        const cancelBtn = modal.querySelector('#cancelBtn');

        // Handle radio button changes
        donorTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'donor') {
                    donorDetailsSection.style.display = 'block';
                    submitBtn.disabled = true; // Disable until name is entered
                    submitBtn.style.opacity = '0.5';
                    donorNameInput.focus(); // Focus on the name input
                } else {
                    donorDetailsSection.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }
            });
        });

        // Handle donor name input
        donorNameInput.addEventListener('input', () => {
            const hasName = donorNameInput.value.trim().length > 0;
            const selectedType = modal.querySelector('input[name="donorType"]:checked')?.value;

            if (selectedType === 'donor') {
                submitBtn.disabled = !hasName;
                submitBtn.style.opacity = hasName ? '1' : '0.5';
            }
        });

        // Handle submit
        submitBtn.addEventListener('click', () => {
            const selectedType = modal.querySelector('input[name="donorType"]:checked')?.value;

            if (!selectedType) {
                showModalError('Please select who donated the blood.');
                return;
            }

            let donorInfo = '';
            if (selectedType === 'relative') {
                donorInfo = 'Relative';
            } else if (selectedType === 'donor') {
                const donorName = donorNameInput.value.trim();
                const donorContact = donorContactInput.value.trim();

                if (!donorName) {
                    showModalError('Please enter the donor name.');
                    donorNameInput.focus();
                    return;
                }

                // Validate donor name (basic validation)
                if (donorName.length < 2) {
                    showModalError('Donor name must be at least 2 characters long.');
                    donorNameInput.focus();
                    return;
                }

                donorInfo = donorContact ? `${donorName}, ${donorContact}` : donorName;
            } else if (selectedType === 'noDonation') {
                donorInfo = 'Other - No donation';
            }

            // Remove modal
            modal.remove();
            resolve(donorInfo);
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Handle clicking outside modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });

        // Handle escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                resolve(null);
                document.removeEventListener('keydown', escapeHandler);
            }
        });

        // Handle enter key in input fields
        donorNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                submitBtn.click();
            }
        });

        donorContactInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                submitBtn.click();
            }
        });

        // Focus on first radio button initially
        setTimeout(() => {
            const firstRadio = modal.querySelector('input[name="donorType"]');
            if (firstRadio) {
                firstRadio.focus();
            }
        }, 100);
    });
}

// Function to show error messages in the modal
function showModalError(message) {
    // Remove any existing error messages
    const existingError = document.querySelector('.modal-error');
    if (existingError) {
        existingError.remove();
    }

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'modal-error bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm';
    errorDiv.textContent = message;

    // Insert error message before the buttons
    const modal = document.getElementById('donorInfoModal');
    const buttonsContainer = modal.querySelector('.flex.space-x-3');
    buttonsContainer.parentNode.insertBefore(errorDiv, buttonsContainer);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Function to save donor details to Form Responses 2 sheet
async function saveDonorDetailsToSheet(patientName, bloodType, donorInfo) {
    try {


        // Parse donor info to extract name and contact
        let donorName = '';
        let donorContact = '';

        if (donorInfo.includes(',')) {
            // Format: "Donor Name, Contact Info"
            const parts = donorInfo.split(',');
            donorName = parts[0].trim();
            donorContact = parts[1].trim();
        } else {
            // Format: "Donor Name" (no contact)
            donorName = donorInfo;
        }

        // Prepare donor data for Form Responses 2
        const donorData = {
            fullName: donorName,
            contactNumber: donorContact,
            bloodGroup: bloodType,
            email: '', // Not available from emergency system
            dateOfBirth: '', // Not available from emergency system
            gender: '', // Not available from emergency system
            weight: '', // Not available from emergency system
            city: '', // Not available from emergency system
            area: '', // Not available from emergency system
            emergencyAvailable: 'Yes', // Default to Yes since they're helping
            preferredContact: 'Phone', // Default to Phone
            lastDonation: '', // Not available from emergency system
            medicalHistory: '', // Not available from emergency system
            registrationDate: new Date().toISOString(),
            source: 'emergency_request_system',
            relatedPatientName: patientName
        };

        // Call the Google Apps Script directly
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec';

        // Create URL-encoded form data
        const formData = new URLSearchParams();
        formData.append('action', 'submit_emergency_donor');
        formData.append('data', JSON.stringify(donorData));

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Donor details saved to Form Responses 2 successfully');
        } else {
            console.error('❌ Failed to save donor details:', result.message);
        }

    } catch (error) {
        console.error('❌ Error saving donor details:', error);
    }
}
// Function to copy request data to clipboard
async function copyRequestData(requestData) {
    try {
        // Format the data according to the specified format
        const formattedData = formatRequestDataForCopy(requestData);

        // Copy to clipboard
        await navigator.clipboard.writeText(formattedData);

        // Show success toast
        showCopyToast();

    } catch (error) {
        console.error('❌ Error copying to clipboard:', error);

        // Fallback for browsers that don't support clipboard API
        try {
            const textArea = document.createElement('textarea');
            textArea.value = formatRequestDataForCopy(requestData);
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            // Show success toast
            showCopyToast();
        } catch (fallbackError) {
            console.error('❌ Fallback copy also failed:', fallbackError);
            showCopyToast('Failed to copy');
        }
    }
}

// Function to format request data for copying
function formatRequestDataForCopy(requestData) {
    const formatField = (label, value) => {
        return `*${label}*: ${value || ''}`;
    };

    return [
        formatField('Patient Name', requestData.patientName),
        formatField('Age', requestData.patientAge),
        formatField('Blood Group', requestData.bloodType),
        formatField('Units Required', requestData.unitsRequired),
        formatField('Hospital', requestData.hospitalName),
        formatField('Location', requestData.city),
        formatField('Suffering From', requestData.diagnosis),
        formatField('Contact Person', requestData.contactPerson),
        formatField('Contact Number', requestData.contactNumber),
        '',
        '🩸 Connect with Life Savers United - Your community blood donation network',
        '🌐 Visit: https://lifesaversunited.org/',
        '💬 WhatsApp: https://chat.whatsapp.com/HRP2oqTxwbfKRHyH9BxtPw'
    ].join('\n');
}

// Function to show copy toast notification
function showCopyToast(message = 'Copied') {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-weight: 600;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
        font-size: 14px;
    `;
    toast.textContent = message;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { 
                transform: translateX(100%); 
                opacity: 0; 
            }
            to { 
                transform: translateX(0); 
                opacity: 1; 
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Remove the toast after 2 seconds
    setTimeout(() => {
        toast.remove();
        style.remove();
    }, 2000);
}

// Function to show share options modal
function showShareOptions(requestData) {
    return new Promise((resolve) => {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'shareModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            position: relative;
            z-index: 1000000;
        `;
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg style="width: 32px; height: 32px; color: #2563eb;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                    </svg>
                </div>
                <h3 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Share Blood Request</h3>
                <p style="color: #6b7280;">Choose how you want to share this request</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="facebookShareBtn" style="display: flex; align-items: center; padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background-color: #1877f2; color: white; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                    <svg style="width: 24px; height: 24px; margin-right: 12px;" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Share on Facebook</span>
                </button>
                
                <button id="twitterShareBtn" style="display: flex; align-items: center; padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background-color: #000000; color: white; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                    <svg style="width: 24px; height: 24px; margin-right: 12px;" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Share on X (Twitter)</span>
                </button>
                
                <button id="copyShareBtn" style="display: flex; align-items: center; padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background-color: white; color: #374151; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                    <svg style="width: 24px; height: 24px; margin-right: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <span>Copy to Clipboard</span>
                </button>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button id="cancelShareBtn" style="flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; font-weight: 500; background-color: white; cursor: pointer; transition: all 0.2s ease;">
                    Cancel
                </button>
            </div>
        `;

        // Add event listeners
        const facebookBtn = modalContent.querySelector('#facebookShareBtn');
        const twitterBtn = modalContent.querySelector('#twitterShareBtn');
        const copyBtn = modalContent.querySelector('#copyShareBtn');
        const cancelBtn = modalContent.querySelector('#cancelShareBtn');

        // Add hover effects
        facebookBtn.addEventListener('mouseenter', () => {
            facebookBtn.style.backgroundColor = '#166fe5';
        });
        facebookBtn.addEventListener('mouseleave', () => {
            facebookBtn.style.backgroundColor = '#1877f2';
        });

        twitterBtn.addEventListener('mouseenter', () => {
            twitterBtn.style.backgroundColor = '#333333';
        });
        twitterBtn.addEventListener('mouseleave', () => {
            twitterBtn.style.backgroundColor = '#000000';
        });

        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.backgroundColor = '#f3f4f6';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.backgroundColor = 'white';
        });

        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#f3f4f6';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = 'white';
        });

        // Handle Facebook share
        facebookBtn.addEventListener('click', () => {
            shareToFacebook(requestData);
            modal.remove();
            resolve(true);
        });

        // Handle Twitter share
        twitterBtn.addEventListener('click', () => {
            shareToTwitter(requestData);
            modal.remove();
            resolve(true);
        });

        // Handle copy
        copyBtn.addEventListener('click', () => {
            copyRequestData(requestData);
            modal.remove();
            resolve(true);
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });

        // Handle clicking outside modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        });

        // Handle escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                resolve(false);
                document.removeEventListener('keydown', escapeHandler);
            }
        });

        // Add modal content to modal
        modal.appendChild(modalContent);

        // Add modal to page
        document.body.appendChild(modal);
    });
}

// Function to share to Facebook
function shareToFacebook(requestData) {
    const shareText = formatRequestDataForSocialShare(requestData);
    const shareUrl = 'https://lifesaversunited.org';

    // Copy the text to clipboard first
    navigator.clipboard.writeText(shareText).then(() => {
        // Open Facebook sharing
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(facebookUrl, '_blank', 'width=600,height=400');

        // Show message that text is copied and ready to paste
        setTimeout(() => {
            showCopyToast('Text copied! Paste it in the Facebook post');
        }, 500);
    }).catch(() => {
        // Fallback if clipboard fails
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        window.open(facebookUrl, '_blank', 'width=600,height=400');
    });
}

// Function to share to Twitter/X
function shareToTwitter(requestData) {
    const shareText = formatRequestDataForTwitter(requestData);
    const shareUrl = 'https://lifesaversunited.org';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    // Open in new window
    window.open(twitterUrl, '_blank', 'width=600,height=400');
}

// Function to format request data for Twitter (without URL in text)
function formatRequestDataForTwitter(requestData) {
    const city = requestData.city || '';
    const urgency = requestData.urgency || 'Urgent';
    const patientName = requestData.patientName || '';
    const age = requestData.patientAge || '';
    const bloodType = requestData.bloodType || '';
    const units = requestData.unitsRequired || '';
    const hospital = requestData.hospitalName || '';
    const contactPerson = requestData.contactPerson || '';
    const contactNumber = requestData.contactNumber || '';

    // Build the message parts
    const cityPart = city ? `#${city}` : '';
    const urgencyPart = urgency ? `#${urgency}` : '';
    const patientPart = patientName ? patientName : '';
    const agePart = age ? `, ${age}` : '';
    const unitsPart = units ? `${units} unit${units > 1 ? 's' : ''}` : '';
    const bloodTypePart = bloodType ? ` of ${bloodType}` : '';
    const hospitalPart = hospital ? `#${hospital.replace(/\s+/g, '')}` : '';
    const contactPart = contactPerson ? contactPerson : '';
    const phonePart = contactNumber ? ` at ${contactNumber}` : '';

    // Construct the main message
    let message = '';

    // Add location and urgency tags
    if (cityPart || urgencyPart) {
        message += [cityPart, urgencyPart].filter(Boolean).join(' ') + ': ';
    }

    // Add patient info
    if (patientPart) {
        message += patientPart + agePart;
    }

    // Add blood requirement
    if (unitsPart && bloodTypePart) {
        message += `, needs ${unitsPart}${bloodTypePart} blood`;
    }

    // Add hospital info
    if (hospitalPart) {
        message += ` for treatment at ${hospitalPart}`;
    }

    // Add contact info
    if (contactPart || phonePart) {
        message += `. Contact ${contactPart}${phonePart}`;
    }

    // Add only hashtags (no URL for Twitter)
    message += `. 
#BloodDonation #SaveLives #lifesaversUnited #Gujarat`;

    return message;
}

// Function to format request data for social media sharing
function formatRequestDataForSocialShare(requestData) {
    const city = requestData.city || '';
    const urgency = requestData.urgency || 'Urgent';
    const patientName = requestData.patientName || '';
    const age = requestData.patientAge || '';
    const bloodType = requestData.bloodType || '';
    const units = requestData.unitsRequired || '';
    const hospital = requestData.hospitalName || '';
    const contactPerson = requestData.contactPerson || '';
    const contactNumber = requestData.contactNumber || '';

    // Build the message parts
    const cityPart = city ? `#${city}` : '';
    const urgencyPart = urgency ? `#${urgency}` : '';
    const patientPart = patientName ? patientName : '';
    const agePart = age ? `, ${age}` : '';
    const unitsPart = units ? `${units} unit${units > 1 ? 's' : ''}` : '';
    const bloodTypePart = bloodType ? ` of ${bloodType}` : '';
    const hospitalPart = hospital ? `#${hospital.replace(/\s+/g, '')}` : '';
    const contactPart = contactPerson ? contactPerson : '';
    const phonePart = contactNumber ? ` at ${contactNumber}` : '';

    // Construct the main message
    let message = '';

    // Add location and urgency tags
    if (cityPart || urgencyPart) {
        message += [cityPart, urgencyPart].filter(Boolean).join(' ') + ': ';
    }

    // Add patient info
    if (patientPart) {
        message += patientPart + agePart;
    }

    // Add blood requirement
    if (unitsPart && bloodTypePart) {
        message += `, needs ${unitsPart}${bloodTypePart} blood`;
    }

    // Add hospital info
    if (hospitalPart) {
        message += ` for treatment at ${hospitalPart}`;
    }

    // Add contact info
    if (contactPart || phonePart) {
        message += `. Contact ${contactPart}${phonePart}`;
    }

    // Add URL and hashtags
    message += `. 
https://lifesaversunited.org  
#BloodDonation #SaveLives #lifesaversUnited #Gujarat`;

    return message;
}
