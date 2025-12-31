// Local proxy URL to avoid CORS issues
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec';

// Initialize form validation when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeFormValidation();
    initializeDuplicateChecking();
    initializeCaptcha();
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
        // Collect form data
        const formDataObj = new FormData(this);
        const data = {
            patientName: formDataObj.get('patientName'),
            contactPerson: formDataObj.get('contactPerson'),
            contactNumber: formDataObj.get('contactNumber'),
            contactEmail: formDataObj.get('contactEmail'),
            bloodType: formDataObj.get('bloodType'),
            unitsRequired: formDataObj.get('unitsRequired'),
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

            const firebaseModule = await import('./firebase-data-service.js');

            // Get current logged-in user if available
            const { auth } = await import('./firebase-config.js');
            const currentUser = auth.currentUser;

            // Track who created this request
            if (currentUser) {
                data.createdBy = currentUser.displayName || 'User';
                data.createdByUid = currentUser.uid;
            } else {
                data.createdBy = data.patientName; // Use patient name if not logged in
                data.createdByUid = null;
            }

            firebaseResult = await firebaseModule.createNewRequestInFirebase(data, currentUser);

            // Post to Twitter if Firebase save was successful
            if (firebaseResult.success && firebaseResult.action === 'CREATED') {
                try {
                    console.log('📤 Posting to Twitter...');
                    const { functions, httpsCallable } = await import('./firebase-config.js');
                    const postToTwitter = httpsCallable(functions, 'postRequestToTwitter');

                    // Prepare data for Twitter (map field names)
                    const twitterData = {
                        patientName: data.patientName,
                        patientAge: data.patientAge,
                        requiredBloodGroup: data.bloodType,
                        unitsRequired: data.unitsRequired,
                        hospitalName: data.hospitalName,
                        hospitalCity: data.city,
                        contactNumber: data.contactNumber
                    };

                    const twitterResult = await postToTwitter({ requestData: twitterData });

                    if (twitterResult.data.success) {
                        console.log('✅ Posted to Twitter:', twitterResult.data.tweetLink);
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
            // If Firebase fails, we still try Sheets but we should warn the user
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
        }

        // --- Final Result Assessment (Prioritizing Firebase) ---
        const finalResult = firebaseResult.success ? firebaseResult : sheetsResult;

        if (finalResult.success) {
            // Check if this was a reopened request
            if (finalResult.action === 'REOPENED') {
                showSuccessMessage('Previous blood request reopened successfully with updated information! We will contact you soon.');
            } else {
                showSuccessMessage('Blood request submitted successfully! We will contact you soon.');
            }
            this.reset(); // Reset form
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
            if (result.error === 'DUPLICATE_ACTIVE_REQUEST') {
                showErrorMessage('A blood request for this patient is already open. Please check the existing request or contact support.');
            } else {
                showErrorMessage(result.message || 'Failed to submit blood request. Please try again.');
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
    const patientNameInput = document.getElementById('patientName');
    const contactNumberInput = document.getElementById('contactNumber');

    if (patientNameInput && contactNumberInput) {
        // Add event listeners for real-time duplicate checking
        patientNameInput.addEventListener('blur', checkForExistingRequest);
        contactNumberInput.addEventListener('blur', checkForExistingRequest);

        // Also check when both fields have values
        patientNameInput.addEventListener('input', debounce(checkForExistingRequest, 500));
        contactNumberInput.addEventListener('input', debounce(checkForExistingRequest, 500));
    }
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
