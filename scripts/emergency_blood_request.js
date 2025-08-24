// Local proxy URL to avoid CORS issues
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbx0IuZUv6ZQOjA-nm55VqiBVlI2VOhTJJ6z8yNyEtBx8OKdil8BwxqKJl326mIcxCGV4g/exec';

document.getElementById('bloodRequestForm').addEventListener('submit', async function (e) {
    e.preventDefault();

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
            additionalInfo: formDataObj.get('additionalInfo')
        };

        // Submit to Google Apps Script
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
            showSuccessMessage('Blood request submitted successfully! We will contact you soon.');
            this.reset(); // Reset form
        } else {
            showSuccessMessage('Failed to submit blood request. Please try again.');
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        showSuccessMessage('An error occurred while submitting your request. Please try again.');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

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
