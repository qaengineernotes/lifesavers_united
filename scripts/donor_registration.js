// Donor Registration Form Script
// Local server API endpoint for form submission
const SUBMIT_URL = '/api/submit-donor-registration';


// CAPTCHA variables
let captchaAnswer = 0;
let captchaQuestion = '';

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    // Generate initial CAPTCHA
    generateCaptcha();

    // Add event listeners
    setupEventListeners();

    // Initialize form validation
    initializeFormValidation();
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('donorRegistrationForm');
    const refreshCaptchaBtn = document.getElementById('refreshCaptcha');

    // Form submission
    form.addEventListener('submit', handleFormSubmission);

    // CAPTCHA refresh
    refreshCaptchaBtn.addEventListener('click', generateCaptcha);

    // Blood group selection styling
    document.querySelectorAll('input[name="bloodGroup"]').forEach(radio => {
        radio.addEventListener('change', function () {
            document.querySelectorAll('.blood-type-option').forEach(option => {
                option.classList.remove('ring-2', 'ring-primary', 'bg-accent-100');
            });
            if (this.checked) {
                this.closest('.blood-type-option').classList.add('ring-2', 'ring-primary', 'bg-accent-100');
            }
        });
    });
}

// Initialize form validation
function initializeFormValidation() {
    // Real-time validation for mandatory fields only
    const fullNameInput = document.getElementById('fullName');
    const contactNumberInput = document.getElementById('contactNumber');

    fullNameInput.addEventListener('blur', () => validateFullName());
    contactNumberInput.addEventListener('blur', () => validateContactNumber());
}

// Generate CAPTCHA
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    let question = '';
    let answer = 0;

    switch (operation) {
        case '+':
            question = `${num1} + ${num2}`;
            answer = num1 + num2;
            break;
        case '-':
            // Ensure positive result
            const larger = Math.max(num1, num2);
            const smaller = Math.min(num1, num2);
            question = `${larger} - ${smaller}`;
            answer = larger - smaller;
            break;
        case '*':
            question = `${num1} × ${num2}`;
            answer = num1 * num2;
            break;
    }

    captchaQuestion = question;
    captchaAnswer = answer;

    document.getElementById('captchaQuestion').textContent = `What is ${question}?`;
    document.getElementById('captchaAnswer').value = '';
}

// Form validation functions
function validateFullName() {
    const fullName = document.getElementById('fullName').value.trim();

    if (!fullName) {
        showFieldError('fullName', 'Full name is required');
        return false;
    } else if (fullName.length < 2) {
        showFieldError('fullName', 'Full name must be at least 2 characters long');
        return false;
    } else if (!/^[a-zA-Z\s]+$/.test(fullName)) {
        showFieldError('fullName', 'Full name can only contain letters and spaces');
        return false;
    } else {
        clearFieldError('fullName');
        return true;
    }
}

function validateDateOfBirth() {
    const dob = document.getElementById('dateOfBirth').value;

    if (!dob) {
        showFieldError('dateOfBirth', 'Date of birth is required');
        return false;
    }

    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 18) {
        showFieldError('dateOfBirth', 'You must be at least 18 years old to donate blood');
        return false;
    } else if (age > 65) {
        showFieldError('dateOfBirth', 'You must be 65 years or younger to donate blood');
        return false;
    } else {
        clearFieldError('dateOfBirth');
        return true;
    }
}

function validateContactNumber() {
    const contact = document.getElementById('contactNumber').value.trim();
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;

    if (!contact) {
        showFieldError('contactNumber', 'Contact number is required');
        return false;
    } else if (!phoneRegex.test(contact.replace(/\D/g, ''))) {
        showFieldError('contactNumber', 'Please enter a valid phone number');
        return false;
    } else {
        clearFieldError('contactNumber');
        return true;
    }
}

function validateEmail() {
    const email = document.getElementById('email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        showFieldError('email', 'Email address is required');
        return false;
    } else if (!emailRegex.test(email)) {
        showFieldError('email', 'Please enter a valid email address');
        return false;
    } else {
        clearFieldError('email');
        return true;
    }
}

function validateWeight() {
    const weight = document.getElementById('weight').value;

    if (!weight) {
        showFieldError('weight', 'Weight is required');
        return false;
    } else if (weight < 50) {
        showFieldError('weight', 'Minimum weight for blood donation is 50kg');
        return false;
    } else if (weight > 200) {
        showFieldError('weight', 'Please enter a valid weight');
        return false;
    } else {
        clearFieldError('weight');
        return true;
    }
}

function validateGender() {
    const gender = document.getElementById('gender').value;

    if (!gender) {
        showFieldError('gender', 'Please select your gender');
        return false;
    } else {
        clearFieldError('gender');
        return true;
    }
}

function validateBloodGroup() {
    const bloodGroup = document.querySelector('input[name="bloodGroup"]:checked');

    if (!bloodGroup) {
        showFieldError('bloodGroup', 'Please select your blood group');
        return false;
    } else {
        clearFieldError('bloodGroup');
        return true;
    }
}

function validateCity() {
    const city = document.getElementById('city').value.trim();

    if (!city) {
        showFieldError('city', 'City is required');
        return false;
    } else if (city.length < 2) {
        showFieldError('city', 'Please enter a valid city name');
        return false;
    } else {
        clearFieldError('city');
        return true;
    }
}

function validateArea() {
    const area = document.getElementById('area').value.trim();

    if (!area) {
        showFieldError('area', 'Area/Locality is required');
        return false;
    } else if (area.length < 2) {
        showFieldError('area', 'Please enter a valid area/locality');
        return false;
    } else {
        clearFieldError('area');
        return true;
    }
}

function validateEmergencyAvailable() {
    const emergency = document.getElementById('emergencyAvailable').value;

    if (!emergency) {
        showFieldError('emergencyAvailable', 'Please specify your emergency availability');
        return false;
    } else {
        clearFieldError('emergencyAvailable');
        return true;
    }
}

function validatePreferredContact() {
    const preferredContact = document.getElementById('preferredContact').value;

    if (!preferredContact) {
        showFieldError('preferredContact', 'Please select your preferred contact method');
        return false;
    } else {
        clearFieldError('preferredContact');
        return true;
    }
}

function validateCaptcha() {
    const userAnswer = parseInt(document.getElementById('captchaAnswer').value);

    if (!document.getElementById('captchaAnswer').value) {
        showFieldError('captcha', 'Please solve the security verification');
        return false;
    } else if (userAnswer !== captchaAnswer) {
        showFieldError('captcha', 'Incorrect answer. Please try again.');
        generateCaptcha(); // Generate new CAPTCHA on wrong answer
        return false;
    } else {
        clearFieldError('captcha');
        return true;
    }
}

// Show field error
function showFieldError(fieldId, message) {
    const errorDiv = document.getElementById(fieldId + 'Error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.color = '#ef4444';
    }

    // Add error styling to input
    const input = document.getElementById(fieldId);
    if (input) {
        input.classList.add('border-error');
    }
}

// Clear field error
function clearFieldError(fieldId) {
    const errorDiv = document.getElementById(fieldId + 'Error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }

    // Remove error styling from input
    const input = document.getElementById(fieldId);
    if (input) {
        input.classList.remove('border-error');
    }
}

// Clear all errors
function clearAllErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.style.display = 'none';
        element.textContent = '';
    });

    // Remove error styling from all inputs
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('border-error');
    });
}

// Validate entire form
function validateForm() {
    clearAllErrors();

    // Only validate mandatory fields: Full Name, Contact Number, Blood Group, and Security Verification
    const isFullNameValid = validateFullName();
    const isContactNumberValid = validateContactNumber();
    const isBloodGroupValid = validateBloodGroup();
    const isCaptchaValid = validateCaptcha();

    return isFullNameValid && isContactNumberValid && isBloodGroupValid && isCaptchaValid;
}

// Handle form submission
async function handleFormSubmission(e) {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
        showErrorMessage('Please fix the validation errors before submitting.');
        return;
    }

    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Registering...';
    submitButton.disabled = true;

    try {
        // Collect form data
        const formDataObj = new FormData(e.target);
        const data = {
            fullName: formDataObj.get('fullName'),
            dateOfBirth: formDataObj.get('dateOfBirth'),
            gender: formDataObj.get('gender'),
            contactNumber: formDataObj.get('contactNumber'),
            email: formDataObj.get('email'),
            weight: formDataObj.get('weight'),
            bloodGroup: formDataObj.get('bloodGroup'),
            city: formDataObj.get('city'),
            area: formDataObj.get('area'),
            emergencyAvailable: formDataObj.get('emergencyAvailable'),
            preferredContact: formDataObj.get('preferredContact'),
            lastDonation: formDataObj.get('lastDonation') || '',
            medicalHistory: formDataObj.get('medicalHistory') || '',
            captchaAnswer: formDataObj.get('captchaAnswer'),
            registrationDate: new Date().toISOString()
        };

        // Submit to local server API
        const submitData = new URLSearchParams();
        submitData.append('data', JSON.stringify(data));

        const response = await fetch(SUBMIT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: submitData
        });

        const result = await response.json();

        if (result.success) {
            // Show success message
            showSuccessMessage();
        } else {
            showErrorMessage(result.message || 'Failed to register. Please try again.');
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        showErrorMessage('An error occurred while submitting your registration. Please try again.');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Show success message
function showSuccessMessage() {
    // Create a success message element
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 9999;
        font-weight: 600;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    successDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span>Registration successful! Thank you for joining our donor community.</span>
        </div>
    `;

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

    // Reset the form
    const form = document.getElementById('donorRegistrationForm');
    form.reset();
    generateCaptcha(); // Generate new CAPTCHA

    // Remove the message after 5 seconds
    setTimeout(() => {
        successDiv.remove();
        style.remove();
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    // Create a temporary error message element
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 9999;
        font-weight: 600;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    errorDiv.textContent = message;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(errorDiv);

    // Remove the message after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
        style.remove();
    }, 5000);
}
