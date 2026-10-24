// Local proxy URL to avoid CORS issues
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec';

// Import phone normalizer utility
import { normalizePhoneNumber } from './phone-normalizer.js';

/**
 * Formats a string to Title Case (e.g., "nikunj mistri" -> "Nikunj Mistri")
 * @param {string} str - The string to format
 * @returns {string} - The formatted string
 */
function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().trim().split(/\s+/).map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Initialize form validation when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeFormValidation();
    initializeDuplicateChecking();
    initializeCaptcha();
    initializeComponentsSection();
});

// Initialize form validation
function initializeFormValidation() {
    const patientNameInput = document.getElementById('patientName');
    const contactNumberInput = document.getElementById('contactNumber');

    if (patientNameInput) {
        patientNameInput.addEventListener('blur', validatePatientName);
        patientNameInput.addEventListener('input', clearPatientNameError);
    }

    if (contactNumberInput) {
        contactNumberInput.addEventListener('blur', validateContactNumber);
        contactNumberInput.addEventListener('input', clearContactNumberError);
    }
}

// Validate patient name
function validatePatientName() {
    const input = document.getElementById('patientName');
    const errorDiv = document.getElementById('patientNameError');
    const value = input.value.trim();

    if (!value) {
        showFieldError(input, errorDiv, 'Patient name is required');
        return false;
    }

    if (value.length < 2) {
        showFieldError(input, errorDiv, 'Patient name must be at least 2 characters long');
        return false;
    }

    if (!/^[a-zA-Z\s]+$/.test(value)) {
        showFieldError(input, errorDiv, 'Patient name should only contain letters and spaces');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

// Validate contact number
function validateContactNumber() {
    const input = document.getElementById('contactNumber');
    const errorDiv = document.getElementById('contactNumberError');
    const value = input.value.trim();

    if (!value) {
        showFieldError(input, errorDiv, 'Contact number is required');
        return false;
    }

    if (!/^\d{10,15}$/.test(value)) {
        showFieldError(input, errorDiv, 'Please enter a valid contact number (10-15 digits)');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

// Clear patient name error on input
function clearPatientNameError() {
    const input = document.getElementById('patientName');
    const errorDiv = document.getElementById('patientNameError');
    clearFieldError(input, errorDiv);
}

// Clear contact number error on input
function clearContactNumberError() {
    const input = document.getElementById('contactNumber');
    const errorDiv = document.getElementById('contactNumberError');
    clearFieldError(input, errorDiv);
}

// Show field error
function showFieldError(input, errorDiv, message) {
    input.classList.add('error');
    input.classList.remove('valid');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    errorDiv.classList.add('show');
}

// Clear field error
function clearFieldError(input, errorDiv) {
    input.classList.remove('error');
    input.classList.add('valid');
    errorDiv.classList.remove('show');
    errorDiv.classList.add('hidden');
}

document.getElementById('bloodRequestForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // Validate form fields before submission
    const isPatientNameValid = validatePatientName();
    const isContactNumberValid = validateContactNumber();
    const isCaptchaValid = validateCaptcha();

    if (!isPatientNameValid || !isContactNumberValid || !isCaptchaValid) {
        showErrorMessage('Please fix the validation errors before submitting.');
        return;
    }

    // Show loading state
    const submitButton = this.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;

    try {
        // Collect form data and component breakdown
        const formDataObj = new FormData(this);
        const componentBreakdown = getSelectedComponents();
        const bloodComponents = componentBreakdown.map(c => c.component);
        const totalUnits = componentBreakdown.reduce((sum, c) => sum + c.units, 0);
        const unitsRequiredText = componentBreakdown.map(c => `${c.units} ${c.units > 1 ? 'units' : 'unit'} ${c.component}`).join(', ');

        const data = {
            patientName: toTitleCase(formDataObj.get('patientName')),
            contactPerson: toTitleCase(formDataObj.get('contactPerson')),
            contactNumber: normalizePhoneNumber(formDataObj.get('contactNumber')), // Normalize phone number
            contactEmail: formDataObj.get('contactEmail'),
            bloodType: formDataObj.get('bloodType'),
            unitsRequired: totalUnits || parseInt(formDataObj.get('unitsRequired')) || 1,
            unitsRequiredText: unitsRequiredText || formDataObj.get('unitsRequiredText') || '1 unit Whole Blood',
            bloodComponents: bloodComponents.length > 0 ? bloodComponents : ['Whole Blood'],
            componentBreakdown: componentBreakdown.length > 0 ? componentBreakdown : [{ component: 'Whole Blood', code: 'whole_blood', units: 1 }],
            patientAge: formDataObj.get('patientAge'),
            diagnosis: formDataObj.get('diagnosis'),
            urgency: formDataObj.get('urgency'),
            hospitalName: formDataObj.get('hospitalName'),
            city: formDataObj.get('city'),
            hospitalAddress: formDataObj.get('hospitalAddress'),
            additionalInfo: formDataObj.get('additionalInfo'),
            captchaAnswer: formDataObj.get('captchaAnswer')
        };

        let firebaseResult = { success: false };
        let sheetsResult = { success: false };

        // --- 1. ALWAYS Save to Firebase (Primary) ---
        try {
            const { functions, httpsCallable } = await import('./firebase-config.js');
            const submitEmergencyBloodRequest = httpsCallable(functions, 'submitEmergencyBloodRequest');
            const response = await submitEmergencyBloodRequest({ requestData: data });

            if (response.data && response.data.success) {
                firebaseResult = response.data; // contains success, action, requestId
            } else {
                console.error('❌ Firebase Cloud Function returned failure:', response.data?.error);
                firebaseResult = { 
                    success: false, 
                    error: response.data?.error || 'Cloud Function failed' 
                };
            }

            // Post to Twitter if Firebase save was successful
            if (firebaseResult.success && firebaseResult.action === 'CREATED') {
                try {
                    const postToTwitter = httpsCallable(functions, 'postRequestToTwitter');

                    // Prepare data for Twitter (map field names)
                    const twitterData = {
                        patientName: data.patientName,
                        patientAge: data.patientAge,
                        requiredBloodGroup: data.bloodType,
                        unitsRequired: data.unitsRequired,
                        unitsRequiredText: data.unitsRequiredText,
                        bloodComponents: data.bloodComponents,
                        hospitalName: data.hospitalName,
                        hospitalCity: data.city,
                        contactNumber: data.contactNumber
                    };

                    const twitterResult = await postToTwitter({ requestData: twitterData });

                    if (twitterResult.data.success) {
                        // Twitter post successful
                    } else {
                        console.warn('⚠️ Twitter posting failed:', twitterResult.data.error);
                    }
                } catch (twitterError) {
                    console.error('⚠️ Twitter posting error:', twitterError);
                    // Don't fail the whole submission if Twitter fails
                }
            }

        } catch (firebaseError) {
            console.error('❌ Firebase save failed:', firebaseError);
            firebaseResult.success = false;
            firebaseResult.error = firebaseError.message || 'Firebase save failed';
        }

        // --- 2. ALSO Sync to Google Sheets (Secondary/Backup) ---
        try {

            const submitData = new URLSearchParams();
            submitData.append('data', JSON.stringify(data));

            const response = await fetch(SUBMIT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: submitData
            });
            sheetsResult = await response.json();

        } catch (sheetsError) {
            console.error('❌ Google Sheets sync failed:', sheetsError);
            sheetsResult.success = false;
            sheetsResult.error = sheetsError.message || 'Google Sheets sync failed';
        }

        // --- Final Result Assessment (ONLY Firebase determines success) ---
        // We MUST have Firebase success to show success message
        if (firebaseResult.success) {
            // Check if this was a reopened request
            if (firebaseResult.action === 'REOPENED') {
                showSuccessMessage('Previous blood request reopened successfully with updated information! We will contact you soon.');
            } else {
                showSuccessMessage('Blood request submitted successfully! We will contact you soon.');
            }
            this.reset(); // Reset form
            resetComponentsSection(); // Reset component rows
            clearDuplicateWarning(); // Clear any warnings
            generateCaptcha(); // Generate new captcha after successful submission
            // Reset submit button state
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.title = 'Submit Blood Request';
            }
        } else {
            // Handle specific error cases
            if (firebaseResult.error === 'DUPLICATE_ACTIVE_REQUEST') {
                showErrorMessage('A blood request for this patient is already open. Please check the existing request or contact support.');
            } else if (firebaseResult.error) {
                showErrorMessage(`Failed to submit blood request: ${firebaseResult.error}. Please try again or contact support.`);
            } else {
                showErrorMessage('Failed to submit blood request to database. Please try again or contact support.');
            }
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        showErrorMessage('An error occurred while submitting your request. Please try again.');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Function to initialize duplicate checking
function initializeDuplicateChecking() {
    // DISABLED: Real-time duplicate checking removed for better UX
    // Duplicate checking now happens only on form submission via Firebase

    /* const patientNameInput = document.getElementById('patientName');
    const contactNumberInput = document.getElementById('contactNumber');

    if (patientNameInput && contactNumberInput) {
        // Add event listeners for real-time duplicate checking
        patientNameInput.addEventListener('blur', checkForExistingRequest);
        contactNumberInput.addEventListener('blur', checkForExistingRequest);

        // Also check when both fields have values
        patientNameInput.addEventListener('input', debounce(checkForExistingRequest, 500));
        contactNumberInput.addEventListener('input', debounce(checkForExistingRequest, 500));
    } */
}

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = later;
    };
}

// Function to check for existing requests
async function checkForExistingRequest() {
    const patientName = document.getElementById('patientName').value.trim();
    const contactNumber = document.getElementById('contactNumber').value.trim();

    // Only check if both fields have values
    if (!patientName || !contactNumber) {
        clearDuplicateWarning();
        return;
    }

    try {
        // Create a temporary div to show checking status
        showCheckingStatus('Checking for existing requests...');

        // Check for existing requests by making a GET request to see all requests
        const response = await fetch(SUBMIT_URL + '?action=check_existing&patientName=' + encodeURIComponent(patientName) + '&contactNumber=' + encodeURIComponent(contactNumber));

        if (response.ok) {
            const result = await response.json();

            if (result.existingRequest) {
                const status = result.existingRequest.status;
                if (status === 'Open' || status === 'Verified') {
                    showDuplicateWarning('⚠️ A blood request for this patient is already active. Please check the existing request or contact support.', 'error');
                    // Disable submit button for active requests
                    const submitBtn = document.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.title = 'Cannot submit: Request already exists';
                    }
                } else if (status === 'Closed') {
                    showDuplicateWarning('ℹ️ A previous request for this patient was closed. This will reopen the request with updated information.', 'info');
                    // Enable submit button for closed requests
                    const submitBtn = document.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.title = 'Submit to reopen previous request';
                    }
                }
            } else {
                clearDuplicateWarning();
                // Enable submit button for new requests
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.title = 'Submit new blood request';
                }
            }
        }
    } catch (error) {
        console.error('Error checking for existing requests:', error);
        // Don't show error to user for duplicate checking
    } finally {
        hideCheckingStatus();
    }
}

// Function to show duplicate warning
function showDuplicateWarning(message, type) {
    clearDuplicateWarning(); // Clear any existing warnings

    const warningDiv = document.createElement('div');
    warningDiv.id = 'duplicateWarning';
    warningDiv.style.cssText = `
        background-color: ${type === 'error' ? '#fef2f2' : '#eff6ff'};
        border: 1px solid ${type === 'error' ? '#fecaca' : '#bfdbfe'};
        color: ${type === 'error' ? '#dc2626' : '#2563eb'};
        padding: 12px 16px;
        border-radius: 8px;
        margin: 16px 0;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    warningDiv.innerHTML = `
        <span style="font-size: 16px;">${type === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span>${message}</span>
    `;

    // Insert warning after the form title
    const formTitle = document.querySelector('.form-card .mb-8');
    if (formTitle) {
        formTitle.parentNode.insertBefore(warningDiv, formTitle.nextSibling);
    }
}

// Function to clear duplicate warning
function clearDuplicateWarning() {
    const existingWarning = document.getElementById('duplicateWarning');
    if (existingWarning) {
        existingWarning.remove();
    }
}

// Function to show checking status
function showCheckingStatus(message) {
    clearCheckingStatus();

    const statusDiv = document.createElement('div');
    statusDiv.id = 'checkingStatus';
    statusDiv.style.cssText = `
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        color: #6b7280;
        padding: 8px 12px;
        border-radius: 6px;
        margin: 16px 0;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    statusDiv.innerHTML = `
        <div style="width: 16px; height: 16px; border: 2px solid #d1d5db; border-top: 2px solid #6b7280; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>${message}</span>
    `;

    // Add CSS animation
    if (!document.getElementById('spinnerCSS')) {
        const style = document.createElement('style');
        style.id = 'spinnerCSS';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Insert status after the form title
    const formTitle = document.querySelector('.form-card .mb-8');
    if (formTitle) {
        formTitle.parentNode.insertBefore(statusDiv, formTitle.nextSibling);
    }
}

// Function to hide checking status
function hideCheckingStatus() {
    const statusDiv = document.getElementById('checkingStatus');
    if (statusDiv) {
        statusDiv.remove();
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
        max-width: 400px;
        word-wrap: break-word;
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

    // Remove the message after 5 seconds
    setTimeout(() => {
        successDiv.remove();
        style.remove();
    }, 5000);
}

// Function to show error message
function showErrorMessage(message) {
    // Create a temporary error message element
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #EF4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 9999;
        font-weight: 600;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    errorDiv.textContent = message;

    // Add animation CSS if not already present
    if (!document.querySelector('style[data-error-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-error-animation', 'true');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(errorDiv);

    // Remove the message after 6 seconds (longer for errors)
    setTimeout(() => {
        errorDiv.remove();
    }, 6000);
}

// Captcha functionality
let currentCaptchaAnswer = 0;

function initializeCaptcha() {
    generateCaptcha();

    // Add event listener for refresh button
    const refreshBtn = document.getElementById('refreshCaptcha');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', generateCaptcha);
    }

    // Add event listener for captcha input
    const captchaInput = document.getElementById('captchaAnswer');
    if (captchaInput) {
        captchaInput.addEventListener('input', clearCaptchaError);
    }
}

function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1; // 1-10
    const num2 = Math.floor(Math.random() * 10) + 1; // 1-10
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let answer;
    let question;

    switch (operator) {
        case '+':
            answer = num1 + num2;
            question = `${num1} + ${num2} = ?`;
            break;
        case '-':
            // Ensure positive result
            if (num1 < num2) {
                answer = num2 - num1;
                question = `${num2} - ${num1} = ?`;
            } else {
                answer = num1 - num2;
                question = `${num1} - ${num2} = ?`;
            }
            break;
        case '×':
            answer = num1 * num2;
            question = `${num1} × ${num2} = ?`;
            break;
    }

    currentCaptchaAnswer = answer;

    const questionElement = document.getElementById('captchaQuestion');
    if (questionElement) {
        questionElement.textContent = question;
    }

    // Clear the input and any errors
    const captchaInput = document.getElementById('captchaAnswer');
    if (captchaInput) {
        captchaInput.value = '';
        clearCaptchaError();
    }
}

function validateCaptcha() {
    const captchaInput = document.getElementById('captchaAnswer');
    const errorDiv = document.getElementById('captchaError');

    if (!captchaInput || !errorDiv) return false;

    const userAnswer = parseInt(captchaInput.value.trim());

    if (!captchaInput.value.trim()) {
        showCaptchaError('Please solve the captcha to continue');
        return false;
    }

    if (userAnswer !== currentCaptchaAnswer) {
        showCaptchaError('Incorrect answer. Please try again.');
        return false;
    }

    clearCaptchaError();
    return true;
}

function showCaptchaError(message) {
    const captchaInput = document.getElementById('captchaAnswer');
    const errorDiv = document.getElementById('captchaError');

    if (captchaInput && errorDiv) {
        captchaInput.classList.add('error');
        captchaInput.classList.remove('valid');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        errorDiv.classList.add('show');
    }
}

function clearCaptchaError() {
    const captchaInput = document.getElementById('captchaAnswer');
    const errorDiv = document.getElementById('captchaError');

    if (captchaInput && errorDiv) {
        captchaInput.classList.remove('error');
        captchaInput.classList.add('valid');
        errorDiv.classList.remove('show');
        errorDiv.classList.add('hidden');
    }
}

// ============================================================================
// DYNAMIC BLOOD COMPONENT & UNITS MANAGEMENT
// ============================================================================

const AVAILABLE_COMPONENTS = [
    { name: 'Whole Blood', label: 'Whole Blood (WB)', code: 'whole_blood' },
    { name: 'Packed Red Blood Cells (PRBC)', label: 'Packed Red Blood Cells (PRBC)', code: 'prbc' },
    { name: 'Single Donor Platelets (SDP)', label: 'Single Donor Platelets (SDP)', code: 'platelets_sdp' },
    { name: 'Random Donor Platelets (RDP)', label: 'Random Donor Platelets (RDP)', code: 'platelets_rdp' },
    { name: 'Fresh Frozen Plasma (FFP)', label: 'Fresh Frozen Plasma (FFP)', code: 'plasma' },
    { name: 'Cryoprecipitate', label: 'Cryoprecipitate', code: 'cryoprecipitate' }
];

let componentRowCounter = 1;

function initializeComponentsSection() {
    const container = document.getElementById('componentsContainer');
    const addBtn = document.getElementById('addAnotherComponentBtn');

    if (!container || !addBtn) return;

    // Add another component button click
    addBtn.addEventListener('click', function () {
        addComponentRow();
    });

    // Event delegation on container for steppers, inputs, selects, and remove buttons
    container.addEventListener('click', function (e) {
        const plusBtn = e.target.closest('.stepper-plus');
        const minusBtn = e.target.closest('.stepper-minus');
        const removeBtn = e.target.closest('.btn-remove-component');

        if (plusBtn) {
            const stepper = plusBtn.closest('.units-stepper');
            const input = stepper.querySelector('.stepper-input');
            let val = parseInt(input.value) || 1;
            if (val < 50) {
                input.value = val + 1;
                updateComponentsSummary();
            }
        } else if (minusBtn) {
            const stepper = minusBtn.closest('.units-stepper');
            const input = stepper.querySelector('.stepper-input');
            let val = parseInt(input.value) || 1;
            if (val > 1) {
                input.value = val - 1;
                updateComponentsSummary();
            }
        } else if (removeBtn) {
            const row = removeBtn.closest('.component-row');
            if (row) {
                removeComponentRow(row);
            }
        }
    });

    // Delegation for input and select changes
    container.addEventListener('input', function (e) {
        if (e.target.classList.contains('stepper-input')) {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 50) val = 50;
            e.target.value = val;
            updateComponentsSummary();
        }
    });

    container.addEventListener('change', function (e) {
        if (e.target.classList.contains('component-select')) {
            updateAvailableComponentOptions();
            updateComponentsSummary();
        }
    });

    updateRowControls();
    updateAvailableComponentOptions();
    updateComponentsSummary();
}

function updateAvailableComponentOptions() {
    const container = document.getElementById('componentsContainer');
    if (!container) return;

    const selects = Array.from(container.querySelectorAll('.component-select'));
    const selectedValues = selects.map(s => s.value);

    selects.forEach(currentSelect => {
        const currentValue = currentSelect.value;
        Array.from(currentSelect.options).forEach(option => {
            const isSelectedElsewhere = selectedValues.includes(option.value) && option.value !== currentValue;
            option.disabled = isSelectedElsewhere;
            const baseComponent = AVAILABLE_COMPONENTS.find(c => c.name === option.value);
            const baseLabel = baseComponent ? baseComponent.label : option.value;
            option.textContent = isSelectedElsewhere ? `${baseLabel} (Already selected)` : baseLabel;
        });
    });
}

function addComponentRow() {
    const container = document.getElementById('componentsContainer');
    const addBtn = document.getElementById('addAnotherComponentBtn');
    if (!container) return;

    const currentRows = container.querySelectorAll('.component-row');
    if (currentRows.length >= AVAILABLE_COMPONENTS.length) return;

    // Find next unselected component
    const selectedValues = Array.from(container.querySelectorAll('.component-select')).map(s => s.value);
    const nextAvailable = AVAILABLE_COMPONENTS.find(c => !selectedValues.includes(c.name));
    if (!nextAvailable) return;

    const rowId = componentRowCounter++;
    const row = document.createElement('div');
    row.className = 'component-row';
    row.setAttribute('data-index', rowId);

    const optionsHtml = AVAILABLE_COMPONENTS.map(c => `
        <option value="${c.name}" ${c.name === nextAvailable.name ? 'selected' : ''}>${c.label}</option>
    `).join('');

    row.innerHTML = `
        <div class="component-select-wrapper">
            <label class="sr-only" for="componentType_${rowId}">Blood Component</label>
            <select id="componentType_${rowId}" class="component-select" required>
                ${optionsHtml}
            </select>
        </div>
        <div class="component-units-wrapper">
            <label class="sr-only" for="componentUnits_${rowId}">Units</label>
            <div class="units-stepper">
                <button type="button" class="stepper-btn stepper-minus" aria-label="Decrease units">−</button>
                <input type="number" id="componentUnits_${rowId}" class="stepper-input" value="1" min="1" max="50" required>
                <button type="button" class="stepper-btn stepper-plus" aria-label="Increase units">+</button>
                <span class="units-suffix">unit(s)</span>
            </div>
        </div>
        <div class="component-action-wrapper">
            <button type="button" class="btn-remove-component" title="Remove component" aria-label="Remove component">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `;

    container.appendChild(row);
    updateRowControls();
    updateAvailableComponentOptions();
    updateComponentsSummary();

    if (container.querySelectorAll('.component-row').length >= AVAILABLE_COMPONENTS.length && addBtn) {
        addBtn.style.display = 'none';
    }
}

function removeComponentRow(row) {
    const container = document.getElementById('componentsContainer');
    const addBtn = document.getElementById('addAnotherComponentBtn');
    if (!container) return;

    // Strictly disallow deleting if only 1 row remains
    const currentRows = container.querySelectorAll('.component-row');
    if (currentRows.length <= 1) return;

    row.remove();
    updateRowControls();
    updateAvailableComponentOptions();
    updateComponentsSummary();

    if (addBtn && container.querySelectorAll('.component-row').length < AVAILABLE_COMPONENTS.length) {
        addBtn.style.display = 'inline-flex';
    }
}

function updateRowControls() {
    const container = document.getElementById('componentsContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.component-row');
    rows.forEach(row => {
        const removeBtn = row.querySelector('.btn-remove-component');
        if (removeBtn) {
            if (rows.length > 1) {
                removeBtn.classList.remove('hidden');
            } else {
                removeBtn.classList.add('hidden');
            }
        }
    });
}

function updateComponentsSummary() {
    const container = document.getElementById('componentsContainer');
    const summaryText = document.getElementById('componentsSummaryText');
    const unitsRequiredHidden = document.getElementById('unitsRequired');
    const unitsRequiredTextHidden = document.getElementById('unitsRequiredText');

    if (!container) return;

    const breakdown = getSelectedComponents();
    if (breakdown.length === 0) {
        if (summaryText) summaryText.textContent = 'Please select at least 1 component';
        if (unitsRequiredHidden) unitsRequiredHidden.value = '1';
        if (unitsRequiredTextHidden) unitsRequiredTextHidden.value = '';
        return;
    }

    const totalUnits = breakdown.reduce((sum, item) => sum + item.units, 0);
    const summaryItems = breakdown.map(item => `${item.units} ${item.units > 1 ? 'units' : 'unit'} ${item.component}`);
    const summaryString = breakdown.length > 1
        ? `${summaryItems.join(', ')} (Total: ${totalUnits} ${totalUnits > 1 ? 'units' : 'unit'})`
        : summaryItems.join(', ');
    const requiredTextString = summaryItems.join(', ');

    if (summaryText) summaryText.textContent = summaryString;
    if (unitsRequiredHidden) unitsRequiredHidden.value = String(totalUnits);
    if (unitsRequiredTextHidden) unitsRequiredTextHidden.value = requiredTextString;
}

function getSelectedComponents() {
    const container = document.getElementById('componentsContainer');
    if (!container) return [];

    const rows = container.querySelectorAll('.component-row');
    const results = [];

    rows.forEach(row => {
        const select = row.querySelector('.component-select');
        const input = row.querySelector('.stepper-input');

        if (select && input) {
            const compName = select.value;
            const units = parseInt(input.value) || 1;
            const matched = AVAILABLE_COMPONENTS.find(c => c.name === compName);
            const code = matched ? matched.code : 'whole_blood';

            results.push({
                component: compName,
                code: code,
                units: units
            });
        }
    });

    return results;
}

function resetComponentsSection() {
    const container = document.getElementById('componentsContainer');
    const addBtn = document.getElementById('addAnotherComponentBtn');
    if (!container) return;

    // Reset to initial 1-row state
    container.innerHTML = `
        <div class="component-row" data-index="0">
            <div class="component-select-wrapper">
                <label class="sr-only" for="componentType_0">Blood Component</label>
                <select id="componentType_0" class="component-select" required>
                    <option value="Whole Blood" selected>Whole Blood (WB)</option>
                    <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>
                    <option value="Single Donor Platelets (SDP)">Single Donor Platelets (SDP)</option>
                    <option value="Random Donor Platelets (RDP)">Random Donor Platelets (RDP)</option>
                    <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
                    <option value="Cryoprecipitate">Cryoprecipitate</option>
                </select>
            </div>
            <div class="component-units-wrapper">
                <label class="sr-only" for="componentUnits_0">Units</label>
                <div class="units-stepper">
                    <button type="button" class="stepper-btn stepper-minus" aria-label="Decrease units">−</button>
                    <input type="number" id="componentUnits_0" class="stepper-input" value="1" min="1" max="50" required>
                    <button type="button" class="stepper-btn stepper-plus" aria-label="Increase units">+</button>
                    <span class="units-suffix">unit(s)</span>
                </div>
            </div>
            <div class="component-action-wrapper">
                <button type="button" class="btn-remove-component hidden" title="Remove component" aria-label="Remove component">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `;

    if (addBtn) addBtn.style.display = 'inline-flex';
    updateRowControls();
    updateAvailableComponentOptions();
    updateComponentsSummary();
}

