// Broadcast Email System for Admin Dashboard
import { getCurrentUser, onAuthChange } from './firebase-auth-service.js';
import { db, collection, getDocs, query, limit, addDoc, serverTimestamp } from './firebase-config.js';

export function initializeBroadcastSystem() {
    const broadcastBtnContainer = document.getElementById('broadcastButtonContainer');
    const modal = document.getElementById('broadcastModal');
    const closeBtn = document.getElementById('closeBroadcastModal');
    const cancelBtn = document.getElementById('cancelBroadcast');
    const form = document.getElementById('broadcastForm');
    const submitBtn = document.getElementById('submitBroadcast');
    const btnText = document.getElementById('broadcastBtnText');
    const btnLoader = document.getElementById('broadcastBtnLoader');
    
    const formControls = document.getElementById('broadcastFormControls');
    const confirmStep = document.getElementById('broadcastConfirmStep');
    const nextBtn = document.getElementById('nextToConfirm');
    const backBtn = document.getElementById('backToEdit');
    const previewSubject = document.getElementById('previewSubject');
    const previewMessage = document.getElementById('previewMessage');

    const testToggle = document.getElementById('testEmailToggle');
    const testContainer = document.getElementById('testEmailContainer');
    const testInput = document.getElementById('testEmailAddress');
    const datalist = document.getElementById('donorEmailsList');
    const loaderIndicator = document.getElementById('loadingDonorsIndicator');

    // Ensure the browser doesn't try to validate this hidden field
    if (testInput) testInput.required = false;

    let donorsLoaded = false;

    if (!broadcastBtnContainer || !modal) return;

    // Fetch real donors to populate the test dropdown
    async function fetchDonorEmails() {
        if (donorsLoaded) return;
        
        console.log('Fetching donor emails for test mode...');
        if (loaderIndicator) loaderIndicator.style.display = 'block';
        if (datalist) datalist.innerHTML = '<option value="">Searching...</option>';

        try {
            const donorsRef = collection(db, 'donors');
            // Fetch 50 donors to keep it fast
            const q = query(donorsRef, limit(50));
            const snapshot = await getDocs(q);
            
            if (datalist) {
                datalist.innerHTML = '';
                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.email && data.email.includes('@')) {
                        const option = document.createElement('option');
                        option.value = data.email;
                        option.textContent = `${data.fullName || 'Unknown'} (${data.email})`;
                        datalist.appendChild(option);
                        count++;
                    }
                });
                
                if (count === 0) {
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "No donors with email found";
                    datalist.appendChild(option);
                }
            }
            donorsLoaded = true;
        } catch (error) {
            console.error('Error fetching donors for test mode:', error);
            if (datalist) datalist.innerHTML = '<option value="">Error loading donors</option>';
        } finally {
            if (loaderIndicator) loaderIndicator.style.display = 'none';
        }
    }

    // 1. Authorization: Only show button for Superusers
    onAuthChange((user) => {
        if (user && user.role === 'superuser' && user.status === 'approved') {
            broadcastBtnContainer.classList.remove('hidden');
            broadcastBtnContainer.style.display = 'inline-flex';
        } else {
            broadcastBtnContainer.classList.add('hidden');
            broadcastBtnContainer.style.display = 'none';
        }
    });

    // Handle test toggle
    if (testToggle) {
        testToggle.addEventListener('change', () => {
            if (testToggle.checked) {
                testContainer.style.display = 'flex';
                testContainer.classList.remove('hidden');
                fetchDonorEmails(); // Fetch when enabled
            } else {
                testContainer.style.display = 'none';
                testContainer.classList.add('hidden');
            }
        });
    }

    // Auto-populate recipient name from selected donor email
    if (testInput) {
        testInput.addEventListener('input', () => {
            const emailValue = testInput.value.trim();
            const nameInput = document.getElementById('recipientNameInput');
            if (nameInput && emailValue) {
                const options = datalist.querySelectorAll('option');
                let foundName = '';
                for (const opt of options) {
                    if (opt.value === emailValue) {
                        const parts = opt.textContent.split(' (');
                        if (parts.length > 0) {
                            foundName = parts[0];
                        }
                        break;
                    }
                }
                if (foundName) {
                    nameInput.value = foundName;
                }
            }
        });
    }

    // 2. Modal Controls
    const openModal = (e) => {
        if (e) e.preventDefault();
        console.log('Opening Broadcast Modal (Direct Style)...');
        if (modal) {
            // Reset to step 1
            formControls.style.display = 'flex';
            confirmStep.style.display = 'none';
            confirmStep.classList.add('hidden');
            
            // Reset test toggle and inputs
            if (testToggle) {
                testToggle.checked = false;
                testContainer.style.display = 'none';
                testContainer.classList.add('hidden');
            }
            if (testInput) testInput.value = '';
            const nameInput = document.getElementById('recipientNameInput');
            if (nameInput) nameInput.value = '';

            modal.style.setProperty('display', 'flex', 'important');
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            console.error('Modal element not found!');
        }
    };

    const closeModal = () => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            form.reset();
            const nameInput = document.getElementById('recipientNameInput');
            if (nameInput) nameInput.value = '';
        }
    };

    // Navigation between steps
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const subject = document.getElementById('broadcastSubject').value.trim();
            const message = document.getElementById('broadcastMessage').value.trim();
            const isTest = testToggle ? testToggle.checked : false;
            const testEmail = testInput ? testInput.value.trim() : '';
            const recipientName = document.getElementById('recipientNameInput') ? document.getElementById('recipientNameInput').value.trim() : '';
            
            if (!subject || !message) {
                showToast('Wait!', 'Please fill in both subject and message first.', 'error');
                return;
            }

            if (isTest && !testEmail) {
                showToast('Email Required', 'Please enter a recipient email address.', 'error');
                return;
            }

            // Populate previews (no [TEST] automatic prefix anymore)
            previewSubject.textContent = subject;
            
            let previewText = message;
            if (isTest) {
                const nameToUse = recipientName || 'Recipient';
                previewText = message.replace(/\{\{name\}\}/g, nameToUse);
            } else {
                previewText = message.replace(/\{\{name\}\}/g, 'Donor');
            }
            previewMessage.textContent = previewText;

            // Update confirmation warning text and button styles dynamically
            const confirmWarning = document.getElementById('broadcastConfirmWarning');
            const confirmTitle = document.getElementById('broadcastConfirmTitle');
            const confirmDesc = document.getElementById('broadcastConfirmDesc');
            
            if (isTest) {
                if (confirmWarning) {
                    confirmWarning.style.background = '#f0fdf4';
                    confirmWarning.style.borderColor = '#bbf7d0';
                    confirmWarning.style.color = '#166534';
                }
                if (confirmTitle) confirmTitle.textContent = 'Confirm Send';
                if (confirmDesc) confirmDesc.innerHTML = `You are about to send an email to a single recipient: <strong>${testEmail}</strong>.`;
                if (submitBtn) {
                    submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    submitBtn.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)';
                }
                if (btnText) btnText.textContent = 'Yes, Send Email';
            } else {
                if (confirmWarning) {
                    confirmWarning.style.background = '#fdf2f2';
                    confirmWarning.style.borderColor = '#fbd5d5';
                    confirmWarning.style.color = '#c81e1e';
                }
                if (confirmTitle) confirmTitle.textContent = 'Final Confirmation';
                if (confirmDesc) confirmDesc.textContent = 'You are about to send an email to every registered donor in the database. This action cannot be undone.';
                if (submitBtn) {
                    submitBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                    submitBtn.style.boxShadow = '0 4px 12px rgba(239,68,68,0.3)';
                }
                if (btnText) btnText.textContent = 'Yes, Send to Everyone';
            }

            // Switch views
            formControls.style.display = 'none';
            confirmStep.style.display = 'flex';
            confirmStep.classList.remove('hidden');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            formControls.style.display = 'flex';
            confirmStep.style.display = 'none';
            confirmStep.classList.add('hidden');
        });
    }

    // Use multiple attachment points for robustness
    broadcastBtnContainer.onclick = openModal;
    broadcastBtnContainer.addEventListener('click', openModal);
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // 3. Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = getCurrentUser();
        if (!user || user.role !== 'superuser') {
            showToast('Unauthorized', 'Only Superusers can send broadcasts.', 'error');
            return;
        }

        const subject = document.getElementById('broadcastSubject').value.trim();
        const message = document.getElementById('broadcastMessage').value.trim();
        const isTest = testToggle ? testToggle.checked : false;
        const testEmail = testInput ? testInput.value.trim() : '';
        const recipientName = document.getElementById('recipientNameInput') ? document.getElementById('recipientNameInput').value.trim() : '';
        
        let donorList = [];

        // Loading state
        submitBtn.disabled = true;
        btnText.textContent = isTest ? 'Sending Email...' : 'Preparing Broadcast...';
        btnLoader.classList.remove('hidden');

        try {
            // --- STEP 1: Get Recipients (Client-side fetch to bypass 403 issues) ---
            if (isTest) {
                // If it is a test/single recipient, use the manually typed/auto-populated name
                const testName = recipientName || 'Recipient';
                donorList = [{ email: testEmail, name: testName }];
            } else {
                // Fetch ALL donors from Firebase using the authenticated SDK
                btnText.textContent = 'Fetching Donors...';
                const donorsRef = collection(db, 'donors');
                const snapshot = await getDocs(donorsRef);
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.email && data.email.includes('@')) {
                        donorList.push({
                            email: data.email,
                            name: data.fullName || 'Donor'
                        });
                    }
                });

                if (donorList.length === 0) {
                    throw new Error('No donors with email addresses found in the database.');
                }
                btnText.textContent = `Sending to ${donorList.length} donors...`;
            }

            // --- STEP 2: Send to Cloudflare ---
            const response = await fetch('/broadcast-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject,
                    message,
                    adminUid: user.uid,
                    donorList, // Pass the list directly
                    isTest
                }),
            });

            // Handle potential 500 errors with better messaging
            if (response.status === 500) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error. Check if RESEND_API_KEY is configured.');
            }

            const result = await response.json();

            if (result.success) {
                // Calculate detailed provider stats from waterfall results
                let resendSent = 0;
                let brevoSent = 0;
                let mailjetSent = 0;
                let failedCount = 0;

                if (result.details && Array.isArray(result.details)) {
                    result.details.forEach(item => {
                        const provider = item.provider;
                        const isOk = item.ok;
                        const count = typeof item.count === 'number' ? item.count : 1;

                        if (isOk) {
                            if (provider === 'resend') resendSent += count;
                            else if (provider === 'brevo') brevoSent += count;
                            else if (provider === 'mailjet') mailjetSent += count;
                        } else {
                            // Skip Resend rate limit attempts that successfully fall back
                            if (!(provider === 'resend' && item.isRateLimit)) {
                                failedCount += count;
                            }
                        }
                    });
                }

                // Log the broadcast attempt to Firestore
                try {
                    const logsRef = collection(db, 'broadcast_logs');
                    await addDoc(logsRef, {
                        subject,
                        message,
                        senderUid: user.uid,
                        sentAt: serverTimestamp(),
                        totalRecipients: donorList.length,
                        isTest,
                        stats: {
                            resend: resendSent,
                            brevo: brevoSent,
                            mailjet: mailjetSent,
                            failed: failedCount
                        }
                    });
                    console.log('Broadcast log successfully stored in Firestore.');
                } catch (logError) {
                    console.error('Failed to log broadcast to Firestore:', logError);
                    // Do not block UI success state if only logging fails
                }

                // Construct a detailed success message
                let successMessage = `Broadcast complete. Sent: ${result.sent}, Failed: ${result.failed} (of ${donorList.length} total).`;
                if (!isTest) {
                    successMessage += `<br>Breakdown: Resend (${resendSent}), Brevo (${brevoSent}), Mailjet (${mailjetSent})`;
                }
                showToast('Success!', successMessage, 'success');
                closeModal();
            } else {
                showToast('Failed', result.error || 'Something went wrong.', 'error');
            }
        } catch (error) {
            console.error('Broadcast Error:', error);
            showToast('Error', error.message || 'Failed to connect to the broadcast service.', 'error');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = isTest ? 'Yes, Send Email' : 'Yes, Send to Everyone';
            btnLoader.classList.add('hidden');
        }
    });
}

// ── Helper: Simple Toast Notification ────────────────────────────────────────
function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    
    toast.className = `fixed bottom-8 right-8 ${bgColor} text-white px-6 py-4 rounded-2xl shadow-2xl z-[1000] flex items-center animate-slide-up`;
    toast.innerHTML = `
        <div class="mr-3">
            ${type === 'success' 
                ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            }
        </div>
        <div>
            <div class="font-bold">${title}</div>
            <div class="text-sm opacity-90">${message}</div>
        </div>
    `;

    document.body.appendChild(toast);

    // Style for toast animation
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slide-up {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
