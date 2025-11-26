// NEW DONATION LOGGING FUNCTIONS - TO BE INSERTED

// Function to handle "Log Donation" button click
async function logDonation(requestData, button) {
    // Check authorization first
    const isAuthorized = await checkAuthorization();

    if (!isAuthorized) {
        return; // User is not authorized
    }

    // Show custom popup for donation information
    const donationInfo = await showDonationPopup(requestData);
    if (!donationInfo) {
        return; // User cancelled the popup
    }

    try {
        // Show loading state
        button.disabled = true;
        button.innerHTML = `
            <svg class="w-5 h-5 mr-2 inline animate-spin" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
            Logging...
        `;

        // Prepare the data for the API call
        const donationData = {
            patientName: requestData.patientName,
            bloodType: requestData.bloodType,
            unitsDonated: donationInfo.units,
            donorType: donationInfo.donorType,
            donorName: donationInfo.donorName || '',
            donorContact: donationInfo.donorContact || '',
            closureReason: donationInfo.closureReason || ''
        };

        // Call the Google Apps Script
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxojezkE43grgB_qBBTHXaP4YPYnNRoF8OML5edqL5hixtDbDRZuVWV553hFN2BoDXsuA/exec';

        const formData = new URLSearchParams();
        formData.append('action', 'log_donation');
        formData.append('data', JSON.stringify(donationData));

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
            const card = button.closest('.emergency-request-card');

            if (result.autoClosed) {
                // Request was auto-closed
                button.innerHTML = `
                    <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Closed
                `;
                button.classList.remove('btn-donation');
                button.classList.add('btn-closed');
                button.disabled = true;

                showSuccessMessage('Donation logged and request closed successfully!');
            } else {
                // Request still open, update units display
                button.innerHTML = `
                    <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                    Log Donation
                `;
                button.disabled = false;

                showSuccessMessage(`Donation logged! ${result.unitsRemaining} unit(s) remaining.`);

                // Refresh the page to show updated units
                setTimeout(() => {
                    loadEmergencyRequests();
                }, 1500);
            }

            // Store button state
            const cardKey = `${requestData.patientName}-${requestData.bloodType}`;
            const existingState = buttonStates.get(cardKey) || {};
            const newState = {
                ...existingState,
                closeStatus: result.autoClosed ? 'closed' : 'open'
            };
            buttonStates.set(cardKey, newState);

            isButtonActionInProgress = false;
        } else {
            // Reset button on error
            button.disabled = false;
            button.innerHTML = `
                <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
                Log Donation
            `;
            showSuccessMessage(result.message || 'Failed to log donation. Please try again.');
            isButtonActionInProgress = false;
        }
    } catch (error) {
        console.error('Error logging donation:', error);

        // Reset button on error
        button.disabled = false;
        button.innerHTML = `
            <svg class="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            Log Donation
        `;
        showSuccessMessage('Error logging donation. Please try again.');
        isButtonActionInProgress = false;
    }
}

// Function to show donation popup
function showDonationPopup(requestData) {
    return new Promise((resolve) => {
        const unitsRequired = parseInt(requestData.unitsRequired) || 0;
        const unitsFulfilled = parseInt(requestData.unitsFulfilled) || 0;
        const unitsRemaining = unitsRequired - unitsFulfilled;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'donationPopup';
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
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        `;

        modalContent.innerHTML = `
            <h3 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Log Blood Donation</h3>
            <p style="color: #6b7280; margin-bottom: 16px;">Patient: ${requestData.patientName} | Blood Type: ${requestData.bloodType}</p>
            <p style="color: #059669; font-weight: 600; margin-bottom: 24px;">${unitsFulfilled} / ${unitsRequired} units fulfilled | ${unitsRemaining} remaining</p>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-weight: 600; margin-bottom: 12px;">How many units donated?</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                    ${[1, 2, 3].map(num => `
                        <button class="unit-btn" data-units="${num}" style="padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                            ${num} Unit${num > 1 ? 's' : ''}
                        </button>
                    `).join('')}
                </div>
                <div>
                    <label style="display: block; font-size: 14px; margin-bottom: 4px;">Custom Amount:</label>
                    <input type="number" id="customUnits" min="1" max="${unitsRemaining}" placeholder="Enter units" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                </div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-weight: 600; margin-bottom: 12px;">Who donated?</label>
                <div>
                    <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
                        <input type="radio" name="donorType" value="relative" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span>Relative</span>
                    </label>
                    <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
                        <input type="radio" name="donorType" value="donor" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span>Donor (from database)</span>
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="donorType" value="other" style="width: 16px; height: 16px; margin-right: 12px;">
                        <span>Other (close request)</span>
                    </label>
                </div>
            </div>
            
            <div id="donorDetailsSection" style="display: none; margin-bottom: 24px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Donor Name *</label>
                    <input type="text" id="donorName" placeholder="Enter donor name or 'Unknown'" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                </div>
                <div>
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Contact (Optional)</label>
                    <input type="text" id="donorContact" placeholder="Phone number or email" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                </div>
            </div>
            
            <div id="closureReasonSection" style="display: none; margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Closure Reason *</label>
                <input type="text" id="closureReason" placeholder="e.g., Patient discharged, died, etc." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="cancelBtn" style="flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancel</button>
                <button id="submitBtn" style="flex: 1; padding: 12px; background-color: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Log Donation</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Handle unit button clicks
        let selectedUnits = null;
        modalContent.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modalContent.querySelectorAll('.unit-btn').forEach(b => {
                    b.style.borderColor = '#d1d5db';
                    b.style.backgroundColor = 'white';
                });
                btn.style.borderColor = '#dc2626';
                btn.style.backgroundColor = '#fee2e2';
                selectedUnits = parseInt(btn.getAttribute('data-units'));
                document.getElementById('customUnits').value = '';
            });
        });

        // Handle custom units input
        document.getElementById('customUnits').addEventListener('input', (e) => {
            modalContent.querySelectorAll('.unit-btn').forEach(b => {
                b.style.borderColor = '#d1d5db';
                b.style.backgroundColor = 'white';
            });
            selectedUnits = parseInt(e.target.value) || null;
        });

        // Handle donor type selection
        modalContent.querySelectorAll('input[name="donorType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const donorDetailsSection = document.getElementById('donorDetailsSection');
                const closureReasonSection = document.getElementById('closureReasonSection');

                if (radio.value === 'donor') {
                    donorDetailsSection.style.display = 'block';
                    closureReasonSection.style.display = 'none';
                } else if (radio.value === 'other') {
                    donorDetailsSection.style.display = 'none';
                    closureReasonSection.style.display = 'block';
                } else {
                    donorDetailsSection.style.display = 'none';
                    closureReasonSection.style.display = 'none';
                }
            });
        });

        // Handle cancel
        document.getElementById('cancelBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(null);
        });

        // Handle submit
        document.getElementById('submitBtn').addEventListener('click', () => {
            const donorType = modalContent.querySelector('input[name="donorType"]:checked')?.value;

            // Validation
            if (!selectedUnits || selectedUnits <= 0) {
                alert('Please select or enter the number of units donated');
                return;
            }

            if (selectedUnits > unitsRemaining) {
                alert(`Cannot donate ${selectedUnits} units. Only ${unitsRemaining} units remaining.`);
                return;
            }

            if (!donorType) {
                alert('Please select who donated');
                return;
            }

            const donorName = document.getElementById('donorName')?.value || '';
            const donorContact = document.getElementById('donorContact')?.value || '';
            const closureReason = document.getElementById('closureReason')?.value || '';

            if (donorType === 'donor' && !donorName) {
                alert('Please enter donor name or type "Unknown"');
                return;
            }

            if (donorType === 'other' && !closureReason) {
                alert('Please enter a closure reason');
                return;
            }

            document.body.removeChild(modal);
            resolve({
                units: selectedUnits,
                donorType: donorType,
                donorName: donorName,
                donorContact: donorContact,
                closureReason: closureReason
            });
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(null);
            }
        });
    });
}
