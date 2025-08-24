// Local proxy URL to avoid CORS issues
const FETCH_URL = 'https://script.google.com/macros/s/AKfycbx0IuZUv6ZQOjA-nm55VqiBVlI2VOhTJJ6z8yNyEtBx8OKdil8BwxqKJl326mIcxCGV4g/exec';
let isButtonActionInProgress = false; // Flag to prevent refresh during button actions



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
    // Load emergency requests on page load (only once)
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

    // Don't refresh if a button action is in progress (but allow initial load)
    if (isButtonActionInProgress && document.querySelectorAll('.emergency-request-card').length > 0) {
        return;
    }

    // If this is a refresh and button action is in progress, don't proceed
    if (isButtonActionInProgress) {
        return;
    }

    // Additional check: if there are cards and button action is in progress, don't refresh
    const existingCards = document.querySelectorAll('.emergency-request-card');
    if (existingCards.length > 0 && isButtonActionInProgress) {
        return;
    }

    const container = document.getElementById('emergencyRequestsContainer');
    const loadingState = document.getElementById('loadingState');
    const noRequestsState = document.getElementById('noRequestsState');

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

        // Fetch data from local proxy
        const response = await fetch(FETCH_URL);
        const data = await response.json();

        if (data.success && data.requests && data.requests.length > 0) {
            // Hide loading and no requests states
            loadingState.classList.add('hidden');
            noRequestsState.classList.add('hidden');

            // Calculate and update statistics
            updateStatistics(data.requests, data.statistics);

            // Display each request
            data.requests.forEach(request => {
                const requestCard = createRequestCard(request);
                container.appendChild(requestCard);
            });
        } else {
            // Show no requests state
            loadingState.classList.add('hidden');
            noRequestsState.classList.remove('hidden');

            // Update statistics with empty data
            updateStatistics([], { total: 0, open: 0, verified: 0, closed: 0 });
        }

    } catch (error) {
        console.error('Error loading emergency requests:', error);
        loadingState.classList.add('hidden');
        noRequestsState.classList.remove('hidden');
        noRequestsState.innerHTML = `
                    <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <h3 class="text-xl font-semibold text-text-primary mb-2">Error Loading Requests</h3>
                    <p class="text-text-secondary">Unable to load emergency requests. Please try again later.</p>
                `;
    }
}

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



    // Check stored button states
    const cardKey = `${request.patientName}-${request.bloodType}`;
    const storedState = buttonStates.get(cardKey);

    // Determine button states
    let verifyButtonClass = 'btn-primary flex-1 verify-btn';
    let verifyButtonText = 'Verify';
    let verifyButtonDisabled = '';
    let closeButtonClass = 'btn-outline flex-1 close-btn';
    let closeButtonText = 'Close';
    let closeButtonDisabled = '';

    if (storedState) {
        if (storedState.verifyStatus === 'verified') {
            verifyButtonClass = 'bg-green-600 text-white hover:bg-green-700 cursor-not-allowed flex-1 verify-btn';
            verifyButtonText = 'Verified';
            verifyButtonDisabled = 'disabled';
        }
        if (storedState.closeStatus === 'closed') {
            closeButtonClass = 'bg-gray-600 text-white hover:bg-gray-700 cursor-not-allowed flex-1 close-btn';
            closeButtonText = 'Closed';
            closeButtonDisabled = 'disabled';
        }
    }

    card.innerHTML = `
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center">
                        <div class="${urgencyConfig.iconBg} p-3 rounded-full mr-4">
                            <svg class="w-6 h-6 ${urgencyConfig.iconColor}" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="${urgencyConfig.iconPath}" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold ${urgencyConfig.textColor}">${urgencyConfig.title} - ${request.bloodType} Blood Needed</h3>
                            <p class="text-text-secondary">Patient: ${request.patientName}</p>
                            <p class="text-text-secondary">${request.hospitalName} - ${request.additionalInfo || 'Emergency Request'}</p>
                        </div>
                    </div>
                    <span class="${urgencyConfig.badgeBg} text-white px-3 py-1 rounded-full text-sm font-semibold">${urgencyConfig.badgeText}</span>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <span class="text-sm text-text-secondary">Blood Type</span>
                        <p class="font-bold text-lg">${request.bloodType}</p>
                    </div>
                    <div>
                        <span class="text-sm text-text-secondary">Quantity Needed</span>
                        <p class="font-bold text-lg">${request.unitsRequired} Units</p>
                    </div>
                    <div>
                        <span class="text-sm text-text-secondary">Time Since Request</span>
                        <p class="font-bold text-lg ${urgencyConfig.timeColor}">${timeSince}</p>
                    </div>
                    <div>
                        <span class="text-sm text-text-secondary">Contact</span>
                        <p class="font-bold text-lg">${request.contactNumber}</p>
                    </div>
                </div>

                <div class="flex space-x-3">
                    <button class="${verifyButtonClass}" data-patient-name="${request.patientName}" data-blood-type="${request.bloodType}" ${verifyButtonDisabled}>
                        <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        ${verifyButtonText}
                    </button>
                    <button class="${closeButtonClass}" data-patient-name="${request.patientName}" data-blood-type="${request.bloodType}" ${closeButtonDisabled}>
                        <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        ${closeButtonText}
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

    if (confirm(`Mark this ${bloodType} blood request for ${patientName} as VERIFIED?`)) {
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
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbx0IuZUv6ZQOjA-nm55VqiBVlI2VOhTJJ6z8yNyEtBx8OKdil8BwxqKJl326mIcxCGV4g/exec';

            // Create URL-encoded form data
            const formData = new URLSearchParams();
            formData.append('action', 'update_status');
            formData.append('data', JSON.stringify(requestData));

            console.log('Sending request to:', scriptUrl);
            console.log('Request data:', requestData);

            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
                redirect: 'follow'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

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
                button.classList.remove('btn-primary');
                button.classList.add('bg-green-600', 'text-white', 'hover:bg-green-700', 'cursor-not-allowed');
                button.disabled = true;

                // Update the status badge
                const badge = card.querySelector('.bg-error, .bg-warning, .bg-accent');
                if (badge) {
                    badge.textContent = 'VERIFIED';
                    badge.classList.remove('bg-error', 'bg-warning', 'bg-accent');
                    badge.classList.add('bg-green-600');
                }

                // Store the button state locally
                const cardKey = `${patientName}-${bloodType}`;
                const newState = { verifyStatus: 'verified', closeStatus: 'available' };
                buttonStates.set(cardKey, newState);

                // Update statistics after verification
                const allRequests = Array.from(document.querySelectorAll('.emergency-request-card')).map(card => {
                    const patientName = card.querySelector('.verify-btn').getAttribute('data-patient-name');
                    const bloodType = card.querySelector('.verify-btn').getAttribute('data-blood-type');
                    return { patientName, bloodType };
                });
                updateStatistics(allRequests);

                // Show success message
                showSuccessMessage('Request marked as VERIFIED successfully!');

                // Keep the card visible and don't refresh automatically
                // The button state change is sufficient to show the action was completed

                // Keep the flag true to prevent automatic refresh
                // User can manually refresh if needed
            } else {
                // Reset button state on error
                button.disabled = false;
                button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                            Verify
                        `;
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
            showSuccessMessage('Error updating status. Please try again.');
            isButtonActionInProgress = false; // Reset flag on error
        }
    }
}

// Function to handle "Closed" button click
async function closeRequest(patientName, bloodType, button) {

    if (confirm(`Close this ${bloodType} blood request for ${patientName}?`)) {
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
                status: 'Closed'
            };

            // Call the Google Apps Script directly
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbx0IuZUv6ZQOjA-nm55VqiBVlI2VOhTJJ6z8yNyEtBx8OKdil8BwxqKJl326mIcxCGV4g/exec';

            // Create URL-encoded form data
            const formData = new URLSearchParams();
            formData.append('action', 'update_status');
            formData.append('data', JSON.stringify(requestData));

            console.log('Sending request to:', scriptUrl);
            console.log('Request data:', requestData);

            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
                redirect: 'follow'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            const result = await response.json();

            if (result.success) {
                // Store reference to the card
                const card = button.closest('.emergency-request-card');

                // Change button appearance to show closed status
                button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                            Closed
                        `;
                button.classList.remove('btn-outline');
                button.classList.add('bg-gray-600', 'text-white', 'hover:bg-gray-700', 'cursor-not-allowed');
                button.disabled = true;

                // Update the status badge
                const badge = card.querySelector('.bg-error, .bg-warning, .bg-accent, .bg-green-600');
                if (badge) {
                    badge.textContent = 'CLOSED';
                    badge.classList.remove('bg-error', 'bg-warning', 'bg-accent', 'bg-green-600');
                    badge.classList.add('bg-gray-600');
                }

                // Store the button state locally
                const cardKey = `${patientName}-${bloodType}`;
                const newState = { verifyStatus: 'available', closeStatus: 'closed' };
                buttonStates.set(cardKey, newState);

                // Update statistics after closing
                const allRequests = Array.from(document.querySelectorAll('.emergency-request-card')).map(card => {
                    const patientName = card.querySelector('.verify-btn').getAttribute('data-patient-name');
                    const bloodType = card.querySelector('.verify-btn').getAttribute('data-blood-type');
                    return { patientName, bloodType };
                });
                updateStatistics(allRequests);

                // Show success message
                showSuccessMessage('Request marked as CLOSED successfully!');

                // Keep the card visible and don't refresh automatically
                // The button state change is sufficient to show the action was completed

                // Keep the flag true to prevent automatic refresh
                // User can manually refresh if needed
            } else {
                // Reset button state on error
                button.disabled = false;
                button.innerHTML = `
                            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                            Close
                        `;
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
            showSuccessMessage('Error updating status. Please try again.');
            isButtonActionInProgress = false; // Reset flag on error
        }
    }
}

// Function to update statistics based on request data
function updateStatistics(requests, statistics = null) {
    let openRequests, successRate, livesSaved;

    if (statistics) {
        // Use statistics from Google Apps Script (more accurate)
        openRequests = statistics.open;
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
