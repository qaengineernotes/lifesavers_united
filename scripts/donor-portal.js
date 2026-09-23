/**
 * LifeSavers United - Donor Portal Controller
 * Manages donor session, donation history, interval validations,
 * digital donor card, certificate generation, and availability settings.
 */

import {
    auth,
    db,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    initAppCheck
} from './firebase-config.js';

import {
    sendDonorOtp,
    verifyDonorOtp,
    getLoggedInDonor,
    onDonorAuthChange,
    donorSignOut,
    checkDonorRegistration,
    getOrCreateRecaptchaVerifier,
    initializeDonorAuth,
    TEST_DONOR_PHONE,
    TEST_DONOR_PHONE_NEW
} from './donor-auth-service.js';

import {
    validateDonationInterval,
    calculateEligibilityDates,
    shouldSendThankYouEmail,
    getDonationTypeLabel,
    formatDateReadable,
    toDateObj,
    normalizeDonationType
} from './donation-interval-validator.js';

import { normalizePhoneNumber, formatPhoneNumberForDisplay } from './phone-normalizer.js';
import { generateDonorPortalCard } from './donor-poster-generator.js';
import { generateDonorCertificate } from './donor-certificate-generator.js';
import { initializeUserProfileUI, showUserProfile, hideUserProfile } from './user-profile-ui.js';

let currentDonorData = null;
let donorDonations = [];
let activeFilter = 'all';
let editTargetDonation = null;
let isFirstTimePreviewActive = false;
let editingDonationId = null;
let currentDonationPage = 1;
const DONATIONS_PER_PAGE = 10;
let currentDonorCardBlob = null;
let currentDonorCardUrl = null;
let currentCertBlob = null;
let currentCertUrl = null;
let selectedCertificateDonationId = null;

/**
 * Escape HTML utility
 */
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

/**
 * Determine if current session is operating in mock test donor mode
 * (only when no real donor profile exists in Firestore)
 */
function isTestDonorSession(donor) {
    if (!donor) return false;
    return Boolean(donor.id?.startsWith('test_donor_'));
}

// Initialize on DOM ready
function initPortal() {
    setupEventListeners();
    initializePortalAuth();
    initializeUserProfileUI();
    // Pre-initialize reCAPTCHA so it is ready before user clicks submit
    getOrCreateRecaptchaVerifier('recaptcha-container').catch(err => {
        console.warn('Deferred reCAPTCHA setup:', err);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortal);
} else {
    initPortal();
}


/**
 * Setup UI Event Listeners
 */
function setupEventListeners() {
    // Pre-fill phone from URL param if available (e.g. redirected from registration)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const phoneParam = urlParams.get('phone');
        if (phoneParam) {
            const phoneInput = document.getElementById('donorPhoneNumber');
            if (phoneInput && !phoneInput.value) {
                phoneInput.value = phoneParam.replace(/\D/g, '').slice(-10);
            }
        }
    } catch (e) {}

    // Login form submission
    const loginForm = document.getElementById('donorLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleSendOtp);
    }

    // OTP verification form
    const otpForm = document.getElementById('donorOtpForm');
    if (otpForm) {
        otpForm.addEventListener('submit', handleVerifyOtp);
    }

    // Back to phone button
    const backToPhoneBtn = document.getElementById('backToPhoneBtn');
    if (backToPhoneBtn) {
        backToPhoneBtn.addEventListener('click', () => {
            document.getElementById('otpFormContainer').classList.add('hidden');
            document.getElementById('phoneFormContainer').classList.remove('hidden');
        });
    }

    // Logout button with confirmation
    const logoutBtn = document.getElementById('portalLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirmed = await showCustomConfirm(
                'Log Out of Donor Portal?',
                'Are you sure you want to log out? You will need your registered mobile number to sign back in.',
                'Yes, Log Out',
                'Cancel',
                false
            );
            if (confirmed) {
                await donorSignOut();
                showSuccessMessage('Logged out successfully.', 'success');
            }
        });
    }

    // Event delegation for donation history edit and delete
    const historyList = document.getElementById('donationHistoryList');
    if (historyList) {
        historyList.addEventListener('click', async (e) => {
            const delBtn = e.target.closest('.delete-log-btn');
            if (delBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = delBtn.getAttribute('data-id') || delBtn.dataset.id;
                await handleDeleteDonation(id);
                return;
            }
            const editBtn = e.target.closest('.edit-log-btn');
            if (editBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = editBtn.getAttribute('data-id') || editBtn.dataset.id;
                openEditDonationModal(id);
                return;
            }
            const certBtn = e.target.closest('.view-cert-btn');
            if (certBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = certBtn.getAttribute('data-id') || certBtn.dataset.id;
                selectedCertificateDonationId = id;
                switchPortalTab('certificate');
                return;
            }
        });
    }

    // Tabs switching
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.dataset.tab;
            switchPortalTab(targetTab);
        });
    });

    // History filter buttons
    document.querySelectorAll('.history-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('bg-red-600', 'text-white'));
            e.currentTarget.classList.add('bg-red-600', 'text-white');
            activeFilter = e.currentTarget.dataset.filter;
            currentDonationPage = 1;
            renderDonationHistory();
        });
    });

    // Toggle First-Time Onboarding preview button
    const toggleFirstTimeBtn = document.getElementById('toggleFirstTimeViewBtn');
    if (toggleFirstTimeBtn) {
        toggleFirstTimeBtn.addEventListener('click', () => {
            isFirstTimePreviewActive = !isFirstTimePreviewActive;
            const textEl = document.getElementById('toggleFirstTimeViewText');
            if (isFirstTimePreviewActive) {
                if (textEl) textEl.textContent = 'View My Normal History';
                toggleFirstTimeBtn.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
            } else {
                if (textEl) textEl.textContent = 'Preview First-Time Onboarding';
                toggleFirstTimeBtn.classList.remove('bg-red-50', 'text-red-700', 'border', 'border-red-200');
            }
            renderDonorProfileHeader(currentDonorData);
            renderDonationHistory();
            renderStatsAndCountdowns();
        });
    }

    // Log donation modal open
    const openLogBtn = document.getElementById('openLogDonationBtn');
    if (openLogBtn) {
        openLogBtn.addEventListener('click', openAddDonationModal);
    }

    // Log donation form submit
    const logDonationForm = document.getElementById('logDonationForm');
    if (logDonationForm) {
        logDonationForm.addEventListener('submit', handleSaveDonation);
    }

    // Edit donation form submit
    const editDonationForm = document.getElementById('editDonationForm');
    if (editDonationForm) {
        editDonationForm.addEventListener('submit', handleUpdateDonation);
    }

    // Close modal buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Availability toggle
    const availabilityToggle = document.getElementById('emergencyAvailabilityToggle');
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', handleAvailabilityToggle);
    }

    // Rest Mode (Snooze) form
    const restModeForm = document.getElementById('restModeForm');
    if (restModeForm) {
        restModeForm.addEventListener('submit', handleSaveRestMode);
    }

    // Cancel rest mode button
    const cancelRestBtn = document.getElementById('cancelRestModeBtn');
    if (cancelRestBtn) {
        cancelRestBtn.addEventListener('click', handleCancelRestMode);
    }

    // Auto-suggest date on rest reason change
    const restReasonSelect = document.getElementById('restReasonSelect');
    if (restReasonSelect) {
        restReasonSelect.addEventListener('change', (e) => {
            const untilInput = document.getElementById('restUntilDate');
            if (untilInput && (!untilInput.value || !currentDonorData?.temporaryRest)) {
                untilInput.value = getSuggestedRestDate(e.target.value);
            }
        });
    }

    // Profile update form
    const profileForm = document.getElementById('donorProfileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleUpdateProfile);
    }

    // Download Card Button
    const downloadCardBtn = document.getElementById('downloadCardBtn');
    if (downloadCardBtn) {
        downloadCardBtn.addEventListener('click', downloadDigitalCardAsPng);
    }

    // Share Card on WhatsApp
    const shareCardBtn = document.getElementById('shareCardWhatsAppBtn');
    if (shareCardBtn) {
        shareCardBtn.addEventListener('click', shareDigitalCardWhatsApp);
    }

    // Print / Download Certificate
    const downloadCertBtn = document.getElementById('downloadCertPngBtn');
    if (downloadCertBtn) {
        downloadCertBtn.addEventListener('click', downloadCertificateAsPng);
    }

    const printCertBtn = document.getElementById('printCertificateBtn');
    if (printCertBtn) {
        printCertBtn.addEventListener('click', printCertificate);
    }

    // Certificate Donation Selector Dropdown
    const certSelect = document.getElementById('certificateDonationSelect');
    if (certSelect) {
        certSelect.addEventListener('change', (e) => {
            selectedCertificateDonationId = e.target.value;
            renderCertificate(currentDonorData, selectedCertificateDonationId);
        });
    }

    // Real-time interval check on date change in log modal
    const logDateInput = document.getElementById('logDonationDate');
    const logTypeInput = document.getElementById('logDonationType');
    if (logDateInput && logTypeInput) {
        logDateInput.addEventListener('change', checkLiveValidation);
        logTypeInput.addEventListener('change', checkLiveValidation);
    }
}

/**
 * Initialize donor auth observer
 */
function initializePortalAuth() {
    initializeDonorAuth();
    onDonorAuthChange(async (donor) => {
        currentDonorData = donor;
        if (donor) {
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('dashboardSection').classList.remove('hidden');
            renderDonorProfileHeader(donor);
            await fetchDonationHistory(donor);
            renderStatsAndCountdowns();
            renderSettingsForm(donor);
            renderDigitalCard(donor);
            renderCertificate(donor);

            showUserProfile({
                uid: donor.authUid || donor.id,
                phoneNumber: donor.contactNumber || donor.phoneNumber,
                displayName: donor.fullName || donor.displayName,
                role: 'donor',
                status: 'approved',
                ...donor
            });
        } else {
            document.getElementById('dashboardSection').classList.add('hidden');
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('phoneFormContainer').classList.remove('hidden');
            document.getElementById('otpFormContainer').classList.add('hidden');

            hideUserProfile();
        }
    });
}

/**
 * Handle Requesting Phone OTP
 */
async function handleSendOtp(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('donorPhoneNumber');
    const errorBox = document.getElementById('loginErrorBox');
    const submitBtn = document.getElementById('sendOtpBtn');

    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    const phone = phoneInput.value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying number...';

    try {
        const result = await sendDonorOtp(phone, 'recaptcha-container');
        if (result.success) {
            document.getElementById('phoneFormContainer').classList.add('hidden');
            document.getElementById('otpFormContainer').classList.remove('hidden');
            document.getElementById('otpSentPhoneDisplay').textContent = '+91 ' + formatPhoneNumberForDisplay(phone);
            document.getElementById('otpCodeInput').focus();
        } else {
            // If not registered, display registration CTA link
            if (result.isRegistered === false) {
                const cleanPhone = normalizePhoneNumber(phone);
                errorBox.innerHTML = `${result.message} <br/><a href="/donor_registration?phone=${cleanPhone}" class="font-bold underline text-red-700 mt-1 inline-block">Click here to register as a donor now →</a>`;
            } else if (result.errorCode) {
                errorBox.innerHTML = `<div>${result.message}</div><div class="text-xs text-red-700 opacity-80 mt-1 font-mono">Code: ${result.errorCode}</div>`;
            } else {
                errorBox.textContent = result.message || 'Unable to send OTP.';
            }
            errorBox.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error during OTP send:', err);
        errorBox.textContent = 'An unexpected error occurred. Please try again.';
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Verification Code';
    }
}

/**
 * Handle Verifying OTP
 */
async function handleVerifyOtp(e) {
    e.preventDefault();
    const otpInput = document.getElementById('otpCodeInput');
    const errorBox = document.getElementById('otpErrorBox');
    const verifyBtn = document.getElementById('verifyOtpBtn');

    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    const code = otpInput.value.trim();
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';

    try {
        const result = await verifyDonorOtp(code);
        if (!result.success) {
            errorBox.textContent = result.message || 'Incorrect verification code.';
            errorBox.classList.remove('hidden');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Code & Access Portal';
        }
    } catch (err) {
        console.error('Error verifying OTP:', err);
        errorBox.textContent = 'Verification error. Please try again.';
        errorBox.classList.remove('hidden');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Code & Access Portal';
    }
}

/**
 * Render Header & Profile Bar
 */
function renderDonorProfileHeader(donor) {
    document.getElementById('donorHeaderName').textContent = donor.fullName || 'Valued Donor';
    document.getElementById('donorHeaderBlood').textContent = donor.bloodGroup || 'Blood Donor';
    document.getElementById('donorHeaderCity').textContent = donor.city ? `📍 ${donor.city}, Gujarat` : 'India';

    // Calculate Milestone Tier
    const totalCount = isFirstTimePreviewActive ? 0 : donorDonations.length;
    const tierEl = document.getElementById('donorHeaderTier');
    if (totalCount >= 75) {
        tierEl.className = 'donor-badge-tier tier-platinum';
        tierEl.textContent = '💎 Platinum Lifesaver';
    } else if (totalCount >= 50) {
        tierEl.className = 'donor-badge-tier tier-gold';
        tierEl.textContent = '🥇 Gold Lifesaver';
    } else if (totalCount >= 25) {
        tierEl.className = 'donor-badge-tier tier-silver';
        tierEl.textContent = '🥈 Silver Lifesaver';
    } else if (totalCount >= 1) {
        tierEl.className = 'donor-badge-tier tier-bronze';
        tierEl.textContent = '🥉 Bronze Lifesaver';
    } else {
        tierEl.className = 'donor-badge-tier tier-bronze';
        tierEl.textContent = '🌱 New Lifesaver';
    }

    // Check Temporary Rest (Snooze) Mode
    const restBanner = document.getElementById('donorRestBanner');
    if (donor.temporaryRest && donor.temporaryRest.until) {
        const untilDate = toDateObj(donor.temporaryRest.until);
        const today = new Date();
        if (untilDate && untilDate.getTime() > today.getTime()) {
            restBanner.classList.remove('hidden');
            document.getElementById('restUntilDateDisplay').textContent = formatDateReadable(untilDate);
            document.getElementById('restReasonDisplay').textContent = donor.temporaryRest.reason || 'Medical Recovery';
        } else {
            restBanner.classList.add('hidden');
        }
    } else {
        restBanner.classList.add('hidden');
    }
}

/**
 * Fetch donation logs for this donor
 */
async function fetchDonationHistory(donor) {
    try {
        await initAppCheck();
        const donationsRef = collection(db, 'donation_logs');
        let records = [];
        const cleanContact = normalizePhoneNumber(donor.contactNumber || donor.phoneNumber || '');
        if (cleanContact) {
            // Query 1: by normalized 10-digit contact number
            try {
                const q1 = query(donationsRef, where('donorContact', '==', cleanContact));
                const snap1 = await getDocs(q1);
                snap1.forEach(d => records.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn('10-digit contact query note:', e.message);
            }

            // Query 2: by E.164 formatted contact number (+91...) if present
            const e164Phone = '+91' + cleanContact;
            if (e164Phone !== cleanContact) {
                try {
                    const q2 = query(donationsRef, where('donorContact', '==', e164Phone));
                    const snap2 = await getDocs(q2);
                    snap2.forEach(d => {
                        if (!records.some(r => r.id === d.id)) {
                            records.push({ id: d.id, ...d.data() });
                        }
                    });
                } catch (e) {
                    console.warn('E.164 contact query note:', e.message);
                }
            }
        }

        // Query 3: by donorId if present
        if (donor.id && !donor.id.startsWith('test_donor_')) {
            try {
                const q3 = query(donationsRef, where('donorId', '==', donor.id));
                const snap3 = await getDocs(q3);
                snap3.forEach(d => {
                    if (!records.some(r => r.id === d.id)) {
                        records.push({ id: d.id, ...d.data() });
                    }
                });
            } catch (e) {
                console.warn('donorId query note:', e.message);
            }
        }

        // Sort descending (newest first)
        records.sort((a, b) => {
            const timeA = toDateObj(a.donatedAt || a.timestamp)?.getTime() || 0;
            const timeB = toDateObj(b.donatedAt || b.timestamp)?.getTime() || 0;
            return timeB - timeA;
        });

        donorDonations = records;
        renderDonationHistory();
        renderStatsAndCountdowns();
        renderCertificate(donor, selectedCertificateDonationId || records[0]?.id);
    } catch (err) {
        console.error('Error fetching donation logs:', err);
    }
}

/**
 * Render Donation History Timeline
 */
function renderDonationHistory() {
    const listContainer = document.getElementById('donationHistoryList');
    const emptyState = document.getElementById('historyEmptyState');
    const paginationContainer = document.getElementById('donationPagination');

    if (isFirstTimePreviewActive || !donorDonations || donorDonations.length === 0) {
        listContainer.innerHTML = '';
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            paginationContainer.classList.add('hidden');
        }
        emptyState.classList.remove('hidden');
        initFirstTimeDonorOnboarding(currentDonorData);
        return;
    }

    emptyState.classList.add('hidden');

    const filtered = donorDonations.filter(d => {
        if (activeFilter === 'all') return true;
        return normalizeDonationType(d.donationType) === activeFilter;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">No donations found for this filter.</div>`;
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            paginationContainer.classList.add('hidden');
        }
        return;
    }

    // Pagination Calculation (10 items per page)
    const totalPages = Math.ceil(filtered.length / DONATIONS_PER_PAGE);
    if (currentDonationPage > totalPages) {
        currentDonationPage = Math.max(1, totalPages);
    }

    const startIndex = (currentDonationPage - 1) * DONATIONS_PER_PAGE;
    const paginatedDonations = filtered.slice(startIndex, startIndex + DONATIONS_PER_PAGE);

    listContainer.innerHTML = paginatedDonations.map(d => {
        const isOfficial = d.source !== 'donor_self_reported';
        const dateObj = toDateObj(d.donatedAt || d.timestamp);
        const formattedDate = formatDateReadable(dateObj);
        const typeLabel = escapeHtml(getDonationTypeLabel(d.donationType));
        const units = d.unitsDonated || 1;
        const safeHospital = escapeHtml(d.hospital || 'Voluntary Camp / Blood Center');
        const safePatient = escapeHtml(d.patientName || '');
        const safeNotes = escapeHtml(d.notes || '');
        const safeId = escapeHtml(d.id || '');
        const whatsappText = encodeURIComponent(`Hi LifeSavers United, regarding my official donation on ${formattedDate} at ${d.hospital || ''} (ID: ${d.id})...`);

        return `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-card">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-gray-900 text-base">${formattedDate}</span>
                        <span class="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full">${typeLabel}</span>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">${units} Unit${units > 1 ? 's' : ''}</span>
                    </div>
                    <div>
                        ${isOfficial ? `
                            <span class="source-badge-official" title="Verified by LifeSavers United Coordinator">
                                🛡️ Verified Official
                            </span>
                        ` : `
                            <span class="source-badge-manual" title="Self-reported by you">
                                ✍️ Self-Reported
                            </span>
                        `}
                    </div>
                </div>

                <div class="text-sm text-gray-600 mb-2 break-words">
                    <span class="font-medium text-gray-800">Hospital / Center:</span> ${safeHospital}
                    ${d.patientName && d.patientName !== 'Direct / Voluntary Camp' ? `<br/><span class="font-medium text-gray-800">For Patient:</span> ${safePatient}` : ''}
                    ${d.notes ? `<br/><span class="font-medium text-gray-800">Notes:</span> ${safeNotes}` : ''}
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-2">
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="text-xs text-green-700 font-semibold">❤️ Impact: Saved up to ${units * 3} lives</span>
                        <button type="button" class="text-xs font-bold text-emerald-700 hover:text-emerald-900 view-cert-btn flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer" data-id="${safeId}">
                            📜 Certificate
                        </button>
                    </div>
                    
                    ${!isOfficial ? `
                        <div class="flex items-center gap-3">
                            <button type="button" class="text-xs font-semibold text-blue-600 hover:text-blue-800 edit-log-btn" data-id="${safeId}">
                                ✏️ Edit
                            </button>
                            <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800 delete-log-btn" data-id="${safeId}">
                                🗑️ Delete
                            </button>
                        </div>
                    ` : `
                        <a href="https://wa.me/919979260393?text=${whatsappText}" 
                           target="_blank" rel="noopener noreferrer" 
                           class="text-xs text-gray-500 hover:text-red-600 transition-colors">
                            Question about this? Chat on WhatsApp
                        </a>
                    `}
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Render pagination controls
    renderDonationPagination(totalPages, filtered.length);
}

/**
 * Render Donation History Pagination Controls (matching gallery.html style)
 */
function renderDonationPagination(totalPages, totalCount) {
    const paginationContainer = document.getElementById('donationPagination');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    let paginationHTML = `
        <button type="button" class="pagination-prev" 
                ${currentDonationPage === 1 ? 'disabled' : ''} 
                aria-label="Previous page">
            ‹
        </button>
    `;

    const showPages = 5;
    let startPage = Math.max(1, currentDonationPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);
    if (endPage - startPage + 1 < showPages) {
        startPage = Math.max(1, endPage - showPages + 1);
    }

    if (startPage > 1) {
        paginationHTML += `<button type="button" class="pagination-page" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<button type="button" class="pagination-ellipsis" disabled>...</button>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button type="button" class="pagination-page ${i === currentDonationPage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<button type="button" class="pagination-ellipsis" disabled>...</button>`;
        }
        paginationHTML += `<button type="button" class="pagination-page" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationHTML += `
        <button type="button" class="pagination-next" 
                ${currentDonationPage === totalPages ? 'disabled' : ''} 
                aria-label="Next page">
            ›
        </button>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // Attach click events
    paginationContainer.querySelectorAll('.pagination-page').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDonationPage = parseInt(btn.dataset.page);
            renderDonationHistory();
            const listContainer = document.getElementById('donationHistoryList');
            if (listContainer) {
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });

    const prevBtn = paginationContainer.querySelector('.pagination-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentDonationPage > 1) {
                currentDonationPage--;
                renderDonationHistory();
                const listContainer = document.getElementById('donationHistoryList');
                if (listContainer) {
                    listContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }

    const nextBtn = paginationContainer.querySelector('.pagination-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentDonationPage < totalPages) {
                currentDonationPage++;
                renderDonationHistory();
                const listContainer = document.getElementById('donationHistoryList');
                if (listContainer) {
                    listContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }
}

/**
 * Render Impact Stats and Multi-Type Countdowns
 */
function renderStatsAndCountdowns() {
    if (isFirstTimePreviewActive || !donorDonations || donorDonations.length === 0) {
        document.getElementById('statTotalDonations').textContent = '0';
        document.getElementById('statTotalUnits').textContent = '0';
        document.getElementById('statLivesSaved').textContent = '0';

        const gender = currentDonorData?.gender || 'male';
        const eligibility = calculateEligibilityDates(null, 'whole_blood', gender);

        renderSingleCountdown('wholeBlood', eligibility.wholeBlood);
        renderSingleCountdown('platelets', eligibility.platelets);
        renderSingleCountdown('plasma', eligibility.plasma);
        return;
    }

    const totalDonations = donorDonations.length;
    let totalUnits = 0;
    donorDonations.forEach(d => {
        totalUnits += parseInt(d.unitsDonated) || 1;
    });

    document.getElementById('statTotalDonations').textContent = totalDonations;
    document.getElementById('statTotalUnits').textContent = totalUnits;
    document.getElementById('statLivesSaved').textContent = totalUnits * 3;

    // Calculate Eligibility
    const latestDonation = donorDonations[0];
    const latestDate = latestDonation ? toDateObj(latestDonation.donatedAt || latestDonation.timestamp) : null;
    const latestType = latestDonation ? latestDonation.donationType : 'whole_blood';
    const gender = currentDonorData?.gender || 'male';

    const eligibility = calculateEligibilityDates(latestDate, latestType, gender);

    renderSingleCountdown('wholeBlood', eligibility.wholeBlood);
    renderSingleCountdown('platelets', eligibility.platelets);
    renderSingleCountdown('plasma', eligibility.plasma);
}

function renderSingleCountdown(typeKey, data) {
    const card = document.getElementById(`${typeKey}Card`);
    const statusPill = document.getElementById(`${typeKey}Status`);
    const countDisplay = document.getElementById(`${typeKey}Count`);
    const dateDisplay = document.getElementById(`${typeKey}Date`);

    if (data.isEligible) {
        card.className = 'eligibility-card status-ready';
        statusPill.className = 'eligibility-pill-ready';
        statusPill.textContent = '🟢 Eligible Today';
        countDisplay.textContent = 'Ready to Donate!';
        dateDisplay.textContent = 'You can donate anytime';
    } else {
        card.className = 'eligibility-card status-waiting';
        statusPill.className = 'eligibility-pill-waiting';
        statusPill.textContent = `⏳ ${data.daysRemaining} days remaining`;
        countDisplay.textContent = `${data.daysRemaining} Days`;
        dateDisplay.textContent = `Eligible on: ${data.formattedDate}`;
    }
}

/**
 * Function to show success/toast message without alert (matches emergency_request_system.js)
 * @param {string} message
 * @param {'success'|'warning'|'error'} type
 */
function showSuccessMessage(message, type = 'success') {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'warning' ? '#F59E0B' : (type === 'error' ? '#EF4444' : '#10B981')};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 99999;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: portalSlideIn 0.3s ease-out;
    `;
    successDiv.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes portalSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
        style.remove();
    }, 3000);
}

/**
 * Custom Confirmation Modal returning Promise<boolean>
 * Prompts the user with a confirmation dialog.
 * @param {string} title
 * @param {string} message
 * @param {string} proceedText
 * @param {string} cancelText
 * @param {boolean} isDestructive
 * @returns {Promise<boolean>}
 */
function showCustomConfirm(title, message, proceedText = 'Confirm', cancelText = 'Cancel', isDestructive = true) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'portalCustomConfirmModal';
        modal.className = 'portal-modal-backdrop';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            backdrop-filter: blur(4px);
            padding: 1rem;
            animation: portalFadeIn 0.2s ease-out;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'portal-confirm-modal-box';

        const iconBg = isDestructive ? '#fee2e2' : '#eff6ff';
        const iconColor = isDestructive ? '#dc2626' : '#2563eb';
        const proceedBg = isDestructive ? '#dc2626' : '#2563eb';

        modalContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="width: 56px; height: 56px; background-color: ${iconBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg style="width: 28px; height: 28px; color: ${iconColor};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <h3 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 10px 0; font-family: 'Inter', sans-serif;">${escapeHtml(title)}</h3>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.5; font-family: 'Inter', sans-serif; margin: 0;">${escapeHtml(message)}</p>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="customConfirmCancelBtn" class="portal-btn-secondary" style="flex: 1; padding: 10px 16px; font-size: 14px;">
                    ${escapeHtml(cancelText)}
                </button>
                <button id="customConfirmProceedBtn" class="portal-btn-primary" style="flex: 1; padding: 10px 16px; font-size: 14px; background-color: ${proceedBg};">
                    ${escapeHtml(proceedText)}
                </button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const cancelBtn = modalContent.querySelector('#customConfirmCancelBtn');
        const proceedBtn = modalContent.querySelector('#customConfirmProceedBtn');

        let isCleanedUp = false;
        const cleanup = (result) => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            document.removeEventListener('keydown', keyHandler);
            modal.remove();
            resolve(result);
        };

        const keyHandler = (e) => {
            if (e.key === 'Escape') cleanup(false);
        };
        document.addEventListener('keydown', keyHandler);

        cancelBtn.addEventListener('click', () => cleanup(false));
        proceedBtn.addEventListener('click', () => cleanup(true));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(false);
        });
    });
}

/**
 * Sets a button to its loading state with a Heartbeat/EKG animation.
 * Maintains the original button dimensions using visibility:hidden on content.
 * Matches emergency_request_system.js
 * @param {HTMLElement} button - The button element
 */
function setButtonLoading(button) {
    if (!button || button.classList.contains('btn-loading')) return;

    if (!button.getAttribute('data-original-html')) {
        button.setAttribute('data-original-html', button.innerHTML);
    }

    const originalHTML = button.getAttribute('data-original-html');

    button.classList.add('btn-loading');
    button.disabled = true;

    const isEdit = button.classList.contains('edit-btn');
    const svgWidth = isEdit ? '32px' : '45px';
    const svgHeight = isEdit ? '16px' : '22px';

    button.innerHTML = `
        <span class="btn-loading-content">${originalHTML}</span>
        <div class="btn-heartbeat-loader">
            <svg class="btn-heartbeat-svg" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg" style="width: ${svgWidth}; height: ${svgHeight};">
                <path class="heartbeat-line-anim" d="M0,30 L85,30 L90,10 L97,52 L105,5 L112,45 L120,30 L200,30"
                    fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </div>
    `;
}

/**
 * Resets a button from its loading state back to its original state.
 * @param {HTMLElement} button - The button element
 */
function resetButtonLoading(button) {
    if (!button) return;

    const originalHTML = button.getAttribute('data-original-html');
    if (originalHTML) {
        button.innerHTML = originalHTML;
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
}

/**
 * Open Modal to Add Manual Donation
 */
function openAddDonationModal() {
    // Rule: During active Rest Mode, donor cannot log a donation. Must cancel rest mode first.
    if (currentDonorData?.temporaryRest?.until) {
        const untilDate = toDateObj(currentDonorData.temporaryRest.until);
        const now = new Date();
        if (untilDate && untilDate.getTime() > now.getTime()) {
            const dateStr = formatDateReadable(untilDate);
            const reasonStr = currentDonorData.temporaryRest.reason || 'Medical Recovery';
            alert(`⚠️ Donation Logging Blocked\n\nYou currently have Temporary Rest Mode active until ${dateStr} (${reasonStr}).\n\nTo log a donation, you must first cancel Rest Mode in Settings (Tab 4).`);
            return;
        }
    }

    const modal = document.getElementById('addDonationModal');
    const form = document.getElementById('logDonationForm');
    const errBox = document.getElementById('modalValidationError');
    const submitBtn = document.getElementById('saveDonationBtn');

    form.reset();
    resetButtonLoading(submitBtn);
    errBox.classList.add('hidden');
    errBox.textContent = '';

    // Default to today
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('logDonationDate').max = todayStr;
    document.getElementById('logDonationDate').value = todayStr;

    modal.classList.remove('hidden');
}

/**
 * Live validation check on date or donation type change
 */
function checkLiveValidation() {
    const dateVal = document.getElementById('logDonationDate').value;
    const typeVal = document.getElementById('logDonationType').value;
    const errBox = document.getElementById('modalValidationError');
    const submitBtn = document.getElementById('saveDonationBtn');

    if (!dateVal) return;

    const validation = validateDonationInterval(
        dateVal,
        typeVal,
        donorDonations,
        currentDonorData?.gender || 'male',
        editTargetDonation ? editTargetDonation.id : null
    );

    if (!validation.isValid) {
        errBox.textContent = validation.errorReason;
        errBox.classList.remove('hidden');
        submitBtn.disabled = true;
    } else {
        errBox.classList.add('hidden');
        errBox.textContent = '';
        submitBtn.disabled = false;
    }
}

/**
 * Handle Saving New Manual Donation
 */
async function handleSaveDonation(e) {
    e.preventDefault();
    if (!currentDonorData) return;

    const errBox = document.getElementById('modalValidationError');
    const submitBtn = document.getElementById('saveDonationBtn');

    // Rule: Strict guard against logging donation while in active Rest Mode
    if (currentDonorData?.temporaryRest?.until) {
        const untilDate = toDateObj(currentDonorData.temporaryRest.until);
        const now = new Date();
        if (untilDate && untilDate.getTime() > now.getTime()) {
            errBox.textContent = `Donation logging blocked: Temporary Rest Mode is active until ${formatDateReadable(untilDate)}. Please cancel Rest Mode in Settings before logging a donation.`;
            errBox.classList.remove('hidden');
            return;
        }
    }

    const dateVal = document.getElementById('logDonationDate').value;
    const typeVal = document.getElementById('logDonationType').value;
    const hospitalVal = document.getElementById('logDonationHospital').value.trim();
    const unitsVal = parseInt(document.getElementById('logDonationUnits').value) || 1;
    const notesVal = document.getElementById('logDonationNotes').value.trim();

    // Run interval validation
    const validation = validateDonationInterval(
        dateVal,
        typeVal,
        donorDonations,
        currentDonorData?.gender || 'male'
    );

    if (!validation.isValid) {
        errBox.textContent = validation.errorReason;
        errBox.classList.remove('hidden');
        return;
    }

    setButtonLoading(submitBtn);

    const isTest = isTestDonorSession(currentDonorData);

    try {
        await initAppCheck();
        const donDate = new Date(dateVal + 'T00:00:00');
        const cleanPhone = normalizePhoneNumber(currentDonorData.contactNumber || currentDonorData.phoneNumber || '');
        const logEntry = {
            donorId: currentDonorData.id || '',
            donorName: currentDonorData.fullName || '',
            donorContact: cleanPhone,
            bloodGroup: currentDonorData.bloodGroup || '',
            unitsDonated: unitsVal,
            donationType: typeVal,
            donorType: 'donor',
            hospital: hospitalVal || 'Voluntary Donation Center',
            patientName: 'Direct / Voluntary Camp',
            requestId: '',
            notes: notesVal,
            donatedAt: donDate,
            timestamp: donDate,
            createdAt: serverTimestamp(),
            source: 'donor_self_reported',
            status: 'self_reported',
            recordedByName: currentDonorData.fullName || 'Donor',
            recordedByUid: auth.currentUser?.uid || currentDonorData.authUid || ''
        };

        // Write directly to Firestore donation_logs
        let savedDocId = null;
        if (!isTest) {
            const docRef = await addDoc(collection(db, 'donation_logs'), logEntry);
            savedDocId = docRef.id;
            logEntry.id = savedDocId;
        } else {
            savedDocId = 'test_manual_' + Date.now();
            logEntry.id = savedDocId;
            donorDonations.unshift(logEntry);
        }

        // Check if this newly logged date is more recent than current lastDonatedAt
        const currentLastDate = toDateObj(currentDonorData.lastDonatedAt);
        if (!currentLastDate || donDate.getTime() > currentLastDate.getTime()) {
            if (currentDonorData.id && !currentDonorData.id.startsWith('test_donor_')) {
                try {
                    const donorRef = doc(db, 'donors', currentDonorData.id);
                    await updateDoc(donorRef, {
                        lastDonatedAt: donDate,
                        lastDonationType: typeVal,
                        updatedAt: serverTimestamp()
                    });
                } catch (donorUpErr) {
                    console.warn('Could not update lastDonatedAt on donor doc:', donorUpErr);
                }
            }
            currentDonorData.lastDonatedAt = donDate;
            currentDonorData.lastDonationType = typeVal;
        }

        // 7-Day Email Rule: Dispatch Thank-You & Roadmap Email if donation is within 7 days
        if (currentDonorData.email && shouldSendThankYouEmail(donDate)) {
            fetch('/send-eligibility-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donorEmail: currentDonorData.email,
                    donorName: currentDonorData.fullName,
                    donationDate: donDate.toISOString(),
                    donationType: getDonationTypeLabel(typeVal),
                    hospitalName: hospitalVal,
                    gender: currentDonorData.gender || 'male'
                })
            }).then(r => r.json()).catch(err => console.warn('Email send attempt:', err));
        }

        closeAllModals();
        currentDonationPage = 1;
        if (!isTest) {
            await fetchDonationHistory(currentDonorData);
        } else {
            renderDonationHistory();
            renderStatsAndCountdowns();
        }
        showSuccessMessage('Donation logged successfully! Thank you for saving lives.', 'success');
    } catch (err) {
        console.error('Error saving donation:', err);
        errBox.textContent = `Failed to save donation: ${err.message || 'Please try again.'}`;
        errBox.classList.remove('hidden');
        showSuccessMessage(`Failed to save donation: ${err.message || 'Please try again.'}`, 'error');
    } finally {
        resetButtonLoading(submitBtn);
    }
}

/**
 * Open Modal to Edit Self-Reported Donation
 */
function openEditDonationModal(donationId) {
    const donation = donorDonations.find(d => d.id === donationId);
    if (!donation || donation.source !== 'donor_self_reported') return;

    editTargetDonation = donation;
    const modal = document.getElementById('editDonationModal');
    const errBox = document.getElementById('editValidationError');
    const submitBtn = document.getElementById('updateDonationBtn');

    resetButtonLoading(submitBtn);
    errBox.classList.add('hidden');
    errBox.textContent = '';

    const dateObj = toDateObj(donation.donatedAt || donation.timestamp);
    const dateStr = dateObj ? dateObj.toISOString().split('T')[0] : '';

    document.getElementById('editDonationId').value = donation.id;
    document.getElementById('editDonationDate').value = dateStr;
    document.getElementById('editDonationDate').max = new Date().toISOString().split('T')[0];
    document.getElementById('editDonationType').value = normalizeDonationType(donation.donationType);
    document.getElementById('editDonationHospital').value = donation.hospital || '';
    document.getElementById('editDonationUnits').value = donation.unitsDonated || 1;
    document.getElementById('editDonationNotes').value = donation.notes || '';

    modal.classList.remove('hidden');
}

/**
 * Handle Updating Self-Reported Donation
 */
async function handleUpdateDonation(e) {
    e.preventDefault();
    if (!editTargetDonation) return;

    const id = document.getElementById('editDonationId').value;
    const dateVal = document.getElementById('editDonationDate').value;
    const typeVal = document.getElementById('editDonationType').value;
    const hospitalVal = document.getElementById('editDonationHospital').value.trim();
    const unitsVal = parseInt(document.getElementById('editDonationUnits').value) || 1;
    const notesVal = document.getElementById('editDonationNotes').value.trim();
    const errBox = document.getElementById('editValidationError');
    const submitBtn = document.getElementById('updateDonationBtn');

    // Run validation excluding the current donation from collision
    const validation = validateDonationInterval(
        dateVal,
        typeVal,
        donorDonations,
        currentDonorData?.gender || 'male',
        id
    );

    if (!validation.isValid) {
        errBox.textContent = validation.errorReason;
        errBox.classList.remove('hidden');
        return;
    }

    setButtonLoading(submitBtn);

    const isTest = isTestDonorSession(currentDonorData);

    try {
        const donDate = new Date(dateVal + 'T00:00:00');

        if (!isTest) {
            const logRef = doc(db, 'donation_logs', id);
            await updateDoc(logRef, {
                donatedAt: donDate,
                timestamp: donDate,
                donationType: typeVal,
                hospital: hospitalVal,
                unitsDonated: unitsVal,
                notes: notesVal,
                updatedAt: serverTimestamp()
            });
        } else {
            const idx = donorDonations.findIndex(d => d.id === id);
            if (idx !== -1) {
                donorDonations[idx] = {
                    ...donorDonations[idx],
                    donatedAt: donDate,
                    timestamp: donDate,
                    donationType: typeVal,
                    hospital: hospitalVal,
                    unitsDonated: unitsVal,
                    notes: notesVal
                };
            }
        }

        // Recalculate latest donation date for the donor
        await recalibrateDonorLastDonationDate();

        closeAllModals();
        if (!isTest) {
            await fetchDonationHistory(currentDonorData);
        } else {
            renderDonationHistory();
            renderStatsAndCountdowns();
        }
        showSuccessMessage('Donation updated successfully.', 'success');
    } catch (err) {
        console.error('Error updating donation:', err);
        errBox.textContent = `Failed to update donation: ${err.message || 'Please try again.'}`;
        errBox.classList.remove('hidden');
        showSuccessMessage(`Failed to update donation: ${err.message || 'Please try again.'}`, 'error');
    } finally {
        resetButtonLoading(submitBtn);
    }
}

/**
 * Handle Deleting Self-Reported Donation
 */
async function handleDeleteDonation(donationId) {
    if (!donationId) {
        console.warn('handleDeleteDonation called without donationId');
        return;
    }

    const cleanId = String(donationId).trim();
    const donation = donorDonations.find(d => String(d.id || '').trim() === cleanId);

    // Safeguard: do not allow deleting official coordinator-recorded donations
    if (donation && ((donation.source && donation.source !== 'donor_self_reported') || donation.requestId)) {
        showSuccessMessage('Official coordinator-verified records cannot be deleted.', 'warning');
        return;
    }

    const donDate = donation ? toDateObj(donation.donatedAt || donation.timestamp) : null;
    const dateFormatted = donDate ? formatDateReadable(donDate) : 'this';

    const confirmed = await showCustomConfirm(
        'Delete Donation Record?',
        `Are you sure you want to delete ${dateFormatted === 'this' ? 'this' : 'your ' + dateFormatted} donation record? Your eligibility countdown and donation statistics will update automatically.`,
        'Yes, Delete',
        'Cancel',
        true
    );

    if (!confirmed) return;

    const isTest = isTestDonorSession(currentDonorData);
    try {
        await initAppCheck();
        if (!isTest) {
            const logRef = doc(db, 'donation_logs', cleanId);
            await deleteDoc(logRef);
        }

        // Optimistically remove from local array
        donorDonations = donorDonations.filter(d => String(d.id || '').trim() !== cleanId);

        // Recalibrate last donation date and update donor record
        await recalibrateDonorLastDonationDate(cleanId);

        if (!isTest) {
            await fetchDonationHistory(currentDonorData);
        } else {
            renderDonationHistory();
            renderStatsAndCountdowns();
        }
        showSuccessMessage('Donation record deleted successfully.', 'success');
    } catch (err) {
        console.error('Error deleting donation:', err);
        showSuccessMessage(`Failed to delete donation record: ${err.message || 'Please try again.'}`, 'error');
    }
}

/**
 * Recalibrate lastDonatedAt on the donors document
 */
async function recalibrateDonorLastDonationDate(deletedId = null) {
    const cleanDeletedId = deletedId ? String(deletedId).trim() : null;
    const remaining = donorDonations.filter(d => !cleanDeletedId || String(d.id || '').trim() !== cleanDeletedId);
    let newestDate = null;
    let newestType = 'whole_blood';

    remaining.forEach(d => {
        const dDate = toDateObj(d.donatedAt || d.timestamp);
        if (dDate && (!newestDate || dDate.getTime() > newestDate.getTime())) {
            newestDate = dDate;
            newestType = d.donationType;
        }
    });

    if (isTestDonorSession(currentDonorData)) {
        currentDonorData.lastDonatedAt = newestDate;
        currentDonorData.lastDonationType = newestType;
        return;
    }

    if (!currentDonorData?.id || currentDonorData.id.startsWith('test_donor_')) {
        currentDonorData.lastDonatedAt = newestDate;
        currentDonorData.lastDonationType = newestType;
        return;
    }

    try {
        const donorRef = doc(db, 'donors', currentDonorData.id);
        if (newestDate) {
            await updateDoc(donorRef, {
                lastDonatedAt: newestDate,
                lastDonationType: newestType,
                updatedAt: serverTimestamp()
            });
        } else {
            await updateDoc(donorRef, {
                lastDonatedAt: null,
                lastDonationType: null,
                updatedAt: serverTimestamp()
            });
        }
        currentDonorData.lastDonatedAt = newestDate;
        currentDonorData.lastDonationType = newestType;
    } catch (recalErr) {
        console.warn('Could not update lastDonatedAt on donor doc:', recalErr);
        currentDonorData.lastDonatedAt = newestDate;
        currentDonorData.lastDonationType = newestType;
    }
}

/**
 * Helper to compute suggested deferral date by reason
 */
function getSuggestedRestDate(reason) {
    const d = new Date();
    switch (reason) {
        case 'Tattoo or Piercing':
            d.setMonth(d.getMonth() + 6);
            break;
        case 'Dental Treatment / Minor Surgery':
            d.setDate(d.getDate() + 3);
            break;
        case 'Medication / Antibiotics / Fever':
            d.setDate(d.getDate() + 7);
            break;
        case 'Recent Vaccination':
            d.setDate(d.getDate() + 14);
            break;
        case 'Low Hemoglobin / Health Rest':
            d.setDate(d.getDate() + 30);
            break;
        case 'Personal Travel / Unavailable':
            d.setDate(d.getDate() + 7);
            break;
        default:
            d.setDate(d.getDate() + 14);
            break;
    }
    return d.toISOString().split('T')[0];
}

/**
 * Update Rest Mode Form UI State (Buttons, Badges, Fields)
 */
function updateRestModeUI(donor) {
    if (!donor) return;
    const isResting = Boolean(donor.temporaryRest && donor.temporaryRest.until);
    const untilDate = isResting ? toDateObj(donor.temporaryRest.until) : null;
    const now = new Date();
    const isActive = Boolean(isResting && untilDate && untilDate.getTime() > now.getTime());

    const statusBadge = document.getElementById('restModeStatusBadge');
    const activateBtn = document.getElementById('activateRestModeBtn');
    const cancelBtn = document.getElementById('cancelRestModeBtn');
    const untilDateInput = document.getElementById('restUntilDate');
    const reasonSelect = document.getElementById('restReasonSelect');

    if (isActive) {
        if (statusBadge) {
            statusBadge.textContent = `Rest Active until ${formatDateReadable(untilDate)}`;
            statusBadge.style.display = 'inline-flex';
            statusBadge.classList.remove('hidden');
        }
        if (activateBtn) {
            activateBtn.textContent = 'Update Rest Mode';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
        if (untilDateInput) {
            const y = untilDate.getFullYear();
            const m = String(untilDate.getMonth() + 1).padStart(2, '0');
            const d = String(untilDate.getDate()).padStart(2, '0');
            untilDateInput.value = `${y}-${m}-${d}`;
        }
        if (reasonSelect && donor.temporaryRest.reason) {
            reasonSelect.value = donor.temporaryRest.reason;
        }
    } else {
        if (statusBadge) {
            statusBadge.style.display = 'none';
            statusBadge.classList.add('hidden');
        }
        if (activateBtn) {
            activateBtn.textContent = 'Activate Rest Mode';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
        if (untilDateInput && !untilDateInput.value && reasonSelect) {
            untilDateInput.value = getSuggestedRestDate(reasonSelect.value);
        }
    }
}

/**
 * Handle Emergency Availability Switch
 */
async function handleAvailabilityToggle(e) {
    const isAvail = e.target.checked;
    const isTest = isTestDonorSession(currentDonorData);

    // If rest mode is currently active, prompt user to confirm ending rest
    if (isAvail && currentDonorData?.temporaryRest?.until) {
        const untilDate = toDateObj(currentDonorData.temporaryRest.until);
        if (untilDate && untilDate.getTime() > Date.now()) {
            const confirmed = window.confirm(
                `You currently have Temporary Rest active until ${formatDateReadable(untilDate)}.\n\nEnabling emergency availability will end your rest mode. Do you want to proceed?`
            );
            if (!confirmed) {
                e.target.checked = false;
                return;
            }

            try {
                await initAppCheck();
                if (!isTest) {
                    const donorRef = doc(db, 'donors', currentDonorData.id);
                    await updateDoc(donorRef, {
                        temporaryRest: null,
                        isEmergencyAvailable: 'yes',
                        emergencyAvailable: 'yes',
                        updatedAt: serverTimestamp()
                    });
                }
                currentDonorData.temporaryRest = null;
                currentDonorData.isEmergencyAvailable = 'yes';
                currentDonorData.emergencyAvailable = 'yes';
                renderDonorProfileHeader(currentDonorData);
                updateRestModeUI(currentDonorData);
                const msgBox = document.getElementById('restModeMsgBox');
                if (msgBox) {
                    msgBox.textContent = 'Temporary rest ended. Emergency availability is now active.';
                    msgBox.className = 'success-banner-box';
                    msgBox.classList.remove('hidden');
                }
                return;
            } catch (err) {
                console.error('Error ending rest mode via toggle:', err);
                alert('Could not update availability. Please try again.');
                e.target.checked = false;
                return;
            }
        }
    }

    try {
        await initAppCheck();
        if (!isTest) {
            const donorRef = doc(db, 'donors', currentDonorData.id);
            await updateDoc(donorRef, {
                isEmergencyAvailable: isAvail ? 'yes' : 'no',
                emergencyAvailable: isAvail ? 'yes' : 'no',
                updatedAt: serverTimestamp()
            });
        }
        currentDonorData.isEmergencyAvailable = isAvail ? 'yes' : 'no';
        currentDonorData.emergencyAvailable = isAvail ? 'yes' : 'no';
    } catch (err) {
        console.error('Error updating availability:', err);
        alert('Could not update availability setting.');
        e.target.checked = !isAvail;
    }
}

/**
 * Handle Saving Temporary Rest Mode (Snooze)
 */
async function handleSaveRestMode(e) {
    e.preventDefault();
    if (!currentDonorData) return;

    const reasonSelect = document.getElementById('restReasonSelect');
    const untilDateInput = document.getElementById('restUntilDate');
    const msgBox = document.getElementById('restModeMsgBox');
    const activateBtn = document.getElementById('activateRestModeBtn') || e.target.querySelector('button[type="submit"]');

    const reason = reasonSelect ? reasonSelect.value : 'Medical Recovery';
    const untilDateStr = untilDateInput ? untilDateInput.value : '';

    if (!untilDateStr) {
        if (msgBox) {
            msgBox.textContent = 'Please choose a "Rest Until Date" to activate rest mode.';
            msgBox.className = 'error-banner-box';
            msgBox.classList.remove('hidden');
        }
        if (untilDateInput) untilDateInput.focus();
        return;
    }

    // Support YYYY-MM-DD, DD-MM-YYYY, and other valid date strings
    let untilDate = null;
    const dateParts = untilDateStr.split(/[-/.]/).map(Number);
    if (dateParts.length === 3 && !dateParts.some(isNaN)) {
        let y, m, d;
        if (dateParts[0] > 1000) {
            [y, m, d] = dateParts;
        } else if (dateParts[2] > 1000) {
            [d, m, y] = dateParts;
        } else {
            [y, m, d] = dateParts;
        }
        untilDate = new Date(y, m - 1, d, 23, 59, 59);
    } else {
        untilDate = new Date(untilDateStr);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!untilDate || isNaN(untilDate.getTime()) || untilDate.getTime() <= today.getTime()) {
        if (msgBox) {
            msgBox.textContent = 'Please select a future date (at least tomorrow) for temporary rest mode.';
            msgBox.className = 'error-banner-box';
            msgBox.classList.remove('hidden');
        }
        if (untilDateInput) untilDateInput.focus();
        return;
    }

    if (activateBtn) {
        activateBtn.disabled = true;
        activateBtn.textContent = 'Saving...';
    }

    try {
        await initAppCheck();

        // 1. Try direct Firestore update (succeeds in production or with authenticated coordinator/donor)
        try {
            if (currentDonorData.id && !currentDonorData.id.startsWith('test_donor_')) {
                const donorRef = doc(db, 'donors', currentDonorData.id);
                await updateDoc(donorRef, {
                    temporaryRest: {
                        reason,
                        until: untilDate,
                        activatedAt: serverTimestamp()
                    },
                    isEmergencyAvailable: 'no',
                    emergencyAvailable: 'no',
                    updatedAt: serverTimestamp()
                });
            } else if (currentDonorData.contactNumber) {
                const donorsRef = collection(db, 'donors');
                const cleanPhone = normalizePhoneNumber(currentDonorData.contactNumber);
                const q = query(donorsRef, where('contactNumber', 'in', [cleanPhone, currentDonorData.contactNumber, Number(cleanPhone)].filter(Boolean)));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const realDocId = snap.docs[0].id;
                    currentDonorData.id = realDocId;
                    await updateDoc(doc(db, 'donors', realDocId), {
                        temporaryRest: {
                            reason,
                            until: untilDate,
                            activatedAt: serverTimestamp()
                        },
                        isEmergencyAvailable: 'no',
                        emergencyAvailable: 'no',
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (firestoreErr) {
            console.warn('Note: Direct Firestore write not permitted without App Check/Auth. Storing in local sync cache:', firestoreErr);
        }

        // 2. Persist to Firestore via backend proxy (admin credentials)
        const rawPhone = currentDonorData.contactNumber || currentDonorData.phoneNumber || '';
        const cleanContact = normalizePhoneNumber(rawPhone);

        try {
            await fetch('/api/update-donor-rest-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donorId: currentDonorData.id,
                    contactNumber: cleanContact || rawPhone,
                    temporaryRest: {
                        reason,
                        until: untilDate.toISOString()
                    },
                    isEmergencyAvailable: 'no'
                })
            });
        } catch (apiErr) {
            console.warn('Backend proxy update note:', apiErr);
        }

        // 3. Persist in local storage sync (ensures instant availability across tabs like donors.html on same browser)
        const restPayload = {
            reason,
            until: untilDate.toISOString(),
            activatedAt: new Date().toISOString()
        };
        if (cleanContact) {
            try { localStorage.setItem('donor_rest_' + cleanContact, JSON.stringify(restPayload)); } catch (e) {}
        }
        if (currentDonorData.id) {
            try { localStorage.setItem('donor_rest_' + currentDonorData.id, JSON.stringify(restPayload)); } catch (e) {}
        }

        currentDonorData.temporaryRest = { reason, until: untilDate };
        currentDonorData.isEmergencyAvailable = 'no';
        currentDonorData.emergencyAvailable = 'no';

        try { localStorage.setItem('lsu_donor_session', JSON.stringify(currentDonorData)); } catch (e) {}

        const availSwitch = document.getElementById('emergencyAvailabilityToggle');
        if (availSwitch) availSwitch.checked = false;

        renderDonorProfileHeader(currentDonorData);
        updateRestModeUI(currentDonorData);

        if (msgBox) {
            msgBox.textContent = `Temporary rest active until ${formatDateReadable(untilDate)}. Emergency alerts paused.`;
            msgBox.className = 'success-banner-box';
            msgBox.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error setting rest mode:', err);
        if (msgBox) {
            msgBox.textContent = `Could not set rest mode: ${err.message || 'Please check your inputs and try again.'}`;
            msgBox.className = 'error-banner-box';
            msgBox.classList.remove('hidden');
        }
    } finally {
        if (activateBtn) {
            activateBtn.disabled = false;
            activateBtn.textContent = 'Update Rest Mode';
        }
    }
}

/**
 * Handle Canceling Temporary Rest Mode
 */
async function handleCancelRestMode() {
    if (!currentDonorData) return;

    const msgBox = document.getElementById('restModeMsgBox');
    const cancelBtn = document.getElementById('cancelRestModeBtn');
    const untilDateInput = document.getElementById('restUntilDate');

    // Check if rest mode was active
    const hadRest = Boolean(currentDonorData.temporaryRest && currentDonorData.temporaryRest.until);
    if (!hadRest) {
        if (msgBox) {
            msgBox.textContent = 'Rest mode is not currently active.';
            msgBox.className = 'error-banner-box';
            msgBox.classList.remove('hidden');
        }
        return;
    }

    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Canceling...';
    }

    try {
        await initAppCheck();

        try {
            if (currentDonorData.id && !currentDonorData.id.startsWith('test_donor_')) {
                const donorRef = doc(db, 'donors', currentDonorData.id);
                await updateDoc(donorRef, {
                    temporaryRest: null,
                    updatedAt: serverTimestamp()
                });
            } else if (currentDonorData.contactNumber) {
                const donorsRef = collection(db, 'donors');
                const cleanPhone = normalizePhoneNumber(currentDonorData.contactNumber);
                const q = query(donorsRef, where('contactNumber', 'in', [cleanPhone, currentDonorData.contactNumber, Number(cleanPhone)].filter(Boolean)));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await updateDoc(doc(db, 'donors', snap.docs[0].id), {
                        temporaryRest: null,
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (firestoreErr) {
            console.warn('Note: Could not clear Firestore rest mode directly:', firestoreErr);
        }

        const rawPhone = currentDonorData.contactNumber || currentDonorData.phoneNumber || '';
        const cleanContact = normalizePhoneNumber(rawPhone);

        // Clear in Firestore via backend proxy
        try {
            await fetch('/api/update-donor-rest-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donorId: currentDonorData.id,
                    contactNumber: cleanContact || rawPhone,
                    temporaryRest: null,
                    isEmergencyAvailable: 'yes'
                })
            });
        } catch (apiErr) {
            console.warn('Backend proxy cancel note:', apiErr);
        }

        if (cleanContact) {
            try { localStorage.removeItem('donor_rest_' + cleanContact); } catch (e) {}
        }
        if (currentDonorData.id) {
            try { localStorage.removeItem('donor_rest_' + currentDonorData.id); } catch (e) {}
        }

        currentDonorData.temporaryRest = null;
        try { localStorage.setItem('lsu_donor_session', JSON.stringify(currentDonorData)); } catch (e) {}

        if (untilDateInput) untilDateInput.value = '';

        renderDonorProfileHeader(currentDonorData);
        updateRestModeUI(currentDonorData);

        if (msgBox) {
            msgBox.textContent = 'Rest mode canceled. You can now update your emergency availability.';
            msgBox.className = 'success-banner-box';
            msgBox.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error canceling rest mode:', err);
        if (msgBox) {
            msgBox.textContent = `Could not cancel rest mode: ${err.message || 'Please try again.'}`;
            msgBox.className = 'error-banner-box';
            msgBox.classList.remove('hidden');
        }
    } finally {
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel Rest';
        }
    }
}

/**
 * Handle Updating Profile Settings (Email, City, Area)
 */
async function handleUpdateProfile(e) {
    e.preventDefault();
    const email = document.getElementById('profileEmail').value.trim();
    const city = document.getElementById('profileCity').value.trim();
    const area = document.getElementById('profileArea').value.trim();
    const msgBox = document.getElementById('profileMsgBox');

    const isTest = isTestDonorSession(currentDonorData);

    try {
        await initAppCheck();
        if (!isTest) {
            const donorRef = doc(db, 'donors', currentDonorData.id);
            await updateDoc(donorRef, {
                email,
                city,
                area,
                updatedAt: serverTimestamp()
            });
        }

        currentDonorData.email = email;
        currentDonorData.city = city;
        currentDonorData.area = area;

        renderDonorProfileHeader(currentDonorData);
        renderDigitalCard(currentDonorData);

        msgBox.textContent = 'Profile details updated successfully!';
        msgBox.className = 'success-banner-box';
        msgBox.classList.remove('hidden');
    } catch (err) {
        console.error('Error updating profile:', err);
        msgBox.textContent = 'Failed to update profile. Please try again.';
        msgBox.className = 'error-banner-box';
        msgBox.classList.remove('hidden');
    }
}

/**
 * Populate Profile Settings Inputs
 */
function renderSettingsForm(donor) {
    document.getElementById('profileFullName').value = donor.fullName || '';
    document.getElementById('profilePhone').value = donor.contactNumber || '';
    document.getElementById('profileBlood').value = donor.bloodGroup || '';
    document.getElementById('profileEmail').value = donor.email || '';
    document.getElementById('profileCity').value = donor.city || '';
    document.getElementById('profileArea').value = donor.area || '';

    const availSwitch = document.getElementById('emergencyAvailabilityToggle');
    if (availSwitch) {
        availSwitch.checked = donor.isEmergencyAvailable === 'yes' || donor.emergencyAvailable === 'yes';
    }

    // Min date for rest mode is tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('restUntilDate');
    if (dateInput) {
        dateInput.min = tomorrow.toISOString().split('T')[0];
    }

    updateRestModeUI(donor);
}

/**
 * Render Digital Donor Card Preview using Official 1080x1080 Poster Generator
 */
async function renderDigitalCard(donor) {
    if (!donor) donor = currentDonorData;
    if (!donor) return;

    const imgEl = document.getElementById('digitalDonorCardImage');
    const spinnerEl = document.getElementById('digitalCardSpinner');
    if (!imgEl) return;

    // Show spinner, hide current image while rendering
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    imgEl.classList.add('hidden');

    const totalCount = isFirstTimePreviewActive ? 0 : donorDonations.length;
    let tierText = 'Bronze Lifesaver';
    if (totalCount >= 75) tierText = 'Platinum Lifesaver';
    else if (totalCount >= 50) tierText = 'Gold Lifesaver';
    else if (totalCount >= 25) tierText = 'Silver Lifesaver';

    try {
        const blob = await generateDonorPortalCard({
            name: donor.fullName || 'Valued Donor',
            bloodGroup: donor.bloodGroup || 'O+',
            tier: tierText,
            donorId: donor.id ? (donor.id.length > 16 ? donor.id.substring(0, 16) + '...' : donor.id) : 'LSU-DONOR',
            city: donor.city ? `${donor.city}, Gujarat` : 'Gujarat, India',
            totalDonations: totalCount
        });

        currentDonorCardBlob = blob;
        if (currentDonorCardUrl) {
            URL.revokeObjectURL(currentDonorCardUrl);
        }
        currentDonorCardUrl = URL.createObjectURL(blob);
        imgEl.src = currentDonorCardUrl;

        imgEl.onload = () => {
            if (spinnerEl) spinnerEl.classList.add('hidden');
            imgEl.classList.remove('hidden');
        };
    } catch (err) {
        console.error('Error generating digital donor card:', err);
        if (spinnerEl) {
            spinnerEl.innerHTML = `<p class="text-sm text-red-600 font-semibold">Unable to generate card preview.</p>`;
        }
    }
}

/**
 * Download Digital Donor Card as PNG
 */
function downloadDigitalCardAsPng() {
    if (!currentDonorCardBlob) {
        showSuccessMessage('Card is generating, please wait a moment...', 'warning');
        return;
    }

    const safeName = (currentDonorData?.fullName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `LifeSavers_Donor_Card_${safeName}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = currentDonorCardUrl || URL.createObjectURL(currentDonorCardBlob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccessMessage('Digital Donor Card downloaded!', 'success');
}

/**
 * Share Digital Card on WhatsApp (or Web Share with image file)
 */
async function shareDigitalCardWhatsApp() {
    const bloodGroup = currentDonorData?.bloodGroup || '';
    const shareText = `I am a registered blood donor with LifeSavers United! 🩸\nBlood Group: ${bloodGroup}\nCheck your eligibility and join the emergency lifeline network at https://lifesaversunited.org`;

    // Try Web Share API with image file if supported on mobile devices
    if (navigator.canShare && currentDonorCardBlob) {
        try {
            const file = new File([currentDonorCardBlob], 'LifeSavers_Donor_Card.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'My Official LifeSavers Donor Card',
                    text: shareText,
                    files: [file]
                });
                return;
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Web share failed, falling back to WhatsApp link:', err);
            } else {
                return;
            }
        }
    }

    // Direct WhatsApp share fallback
    const encodedText = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
}

/**
 * Compute Dynamic Certificate Number (e.g. LSU-202601)
 * Year is dynamic based on donation date, with sequential index
 */
function computeCertificateNumber(donation, allDonations) {
    let year = new Date().getFullYear();
    let seq = 1;

    if (donation) {
        const dDate = toDateObj(donation.donatedAt || donation.timestamp);
        if (dDate && !isNaN(dDate.getTime())) {
            year = dDate.getFullYear();
        }

        // Chronologically sort all donations (oldest to newest) to determine sequence
        const chronological = [...(allDonations || [])].sort((a, b) => {
            const timeA = (toDateObj(a.donatedAt || a.timestamp) || new Date(0)).getTime();
            const timeB = (toDateObj(b.donatedAt || b.timestamp) || new Date(0)).getTime();
            return timeA - timeB;
        });

        const sameYearDonations = chronological.filter(d => {
            const date = toDateObj(d.donatedAt || d.timestamp);
            return date && date.getFullYear() === year;
        });

        const matchIdx = sameYearDonations.findIndex(d => String(d.id || '').trim() === String(donation.id || '').trim());
        if (matchIdx !== -1) {
            seq = matchIdx + 1;
        } else {
            seq = 1;
        }
    }

    const seqStr = String(seq).padStart(2, '0');
    return `LSU-${year}${seqStr}`;
}

/**
 * Render Certificate of Appreciation
 */
async function renderCertificate(donor, targetDonationId) {
    if (!donor) donor = currentDonorData;
    if (!donor) return;

    const imgEl = document.getElementById('certificateImagePreview');
    const spinnerEl = document.getElementById('certificateSpinner');
    const selectEl = document.getElementById('certificateDonationSelect');
    const selectWrap = document.getElementById('certDonationSelectWrapper');

    if (!imgEl) return;

    // Show spinner, hide current image while rendering
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    imgEl.classList.add('hidden');

    const donations = donorDonations || [];

    // Populate dropdown
    if (selectEl) {
        if (donations.length > 0) {
            if (selectWrap) selectWrap.classList.remove('hidden');
            selectEl.innerHTML = donations.map((d) => {
                const dateObj = toDateObj(d.donatedAt || d.timestamp);
                const dateStr = formatDateReadable(dateObj);
                const hospital = d.hospital || 'Voluntary Camp';
                const type = getDonationTypeLabel(d.donationType);
                const certNo = computeCertificateNumber(d, donations);
                const isSelected = String(d.id || '').trim() === String(selectedCertificateDonationId || targetDonationId || donations[0].id || '').trim();
                return `<option value="${escapeHtml(d.id)}" ${isSelected ? 'selected' : ''}>
                    ${escapeHtml(certNo)} • ${dateStr} - ${escapeHtml(hospital)} (${type})
                </option>`;
            }).join('');
        } else {
            if (selectWrap) selectWrap.classList.add('hidden');
            selectEl.innerHTML = `<option value="">Welcome Recognition Certificate</option>`;
        }
    }

    const safeTargetId = typeof targetDonationId === 'object' && targetDonationId !== null
        ? targetDonationId.id
        : targetDonationId;

    // Determine target donation
    let activeDonation = null;
    if (safeTargetId) {
        activeDonation = donations.find(d => String(d.id || '').trim() === String(safeTargetId).trim());
        selectedCertificateDonationId = safeTargetId;
    } else if (selectedCertificateDonationId) {
        activeDonation = donations.find(d => String(d.id || '').trim() === String(selectedCertificateDonationId).trim());
    }

    if (!activeDonation && donations.length > 0) {
        activeDonation = donations[0];
        selectedCertificateDonationId = activeDonation.id;
    }

    if (selectEl && selectedCertificateDonationId) {
        selectEl.value = selectedCertificateDonationId;
    }

    const certNo = computeCertificateNumber(activeDonation, donations);
    const dDate = activeDonation ? toDateObj(activeDonation.donatedAt || activeDonation.timestamp) : new Date();
    const hospitalName = activeDonation ? (activeDonation.hospital || 'Voluntary Camp / Blood Center') : 'LifeSavers United Voluntary Movement';

    try {
        const blob = await generateDonorCertificate({
            name: donor.fullName || 'Valued Donor',
            bloodGroup: donor.bloodGroup || 'O+',
            hospital: hospitalName,
            patientName: activeDonation?.patientName || '',
            donationDate: dDate,
            certificateNo: certNo
        });

        currentCertBlob = blob;
        if (currentCertUrl) {
            URL.revokeObjectURL(currentCertUrl);
        }
        currentCertUrl = URL.createObjectURL(blob);
        imgEl.src = currentCertUrl;

        imgEl.onload = () => {
            if (spinnerEl) spinnerEl.classList.add('hidden');
            imgEl.classList.remove('hidden');
        };
    } catch (err) {
        console.error('Error generating certificate:', err);
        if (spinnerEl) {
            spinnerEl.innerHTML = `<p class="text-sm text-red-600 font-semibold">Unable to generate certificate preview.</p>`;
        }
    }
}

/**
 * Download Certificate as PNG
 */
function downloadCertificateAsPng() {
    if (!currentCertBlob) {
        showSuccessMessage('Certificate is generating, please wait a moment...', 'warning');
        return;
    }

    const safeName = (currentDonorData?.fullName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `LifeSavers_Certificate_${safeName}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = currentCertUrl || URL.createObjectURL(currentCertBlob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccessMessage('Certificate downloaded successfully!', 'success');
}

/**
 * Print / Save Certificate as PDF
 * Uses an isolated hidden iframe for zero popup blocker issues and clean landscape orientation
 */
async function printCertificate() {
    if (!currentCertUrl) {
        if (currentDonorData) {
            showSuccessMessage('Preparing high-resolution certificate for printing...', 'warning');
            await renderCertificate(currentDonorData, selectedCertificateDonationId);
        }
        if (!currentCertUrl) {
            showSuccessMessage('Certificate is generating, please wait a moment...', 'warning');
            return;
        }
    }

    // Reuse or create hidden printing iframe
    let printFrame = document.getElementById('certificatePrintFrame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'certificatePrintFrame';
        printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(printFrame);
    }

    const frameWindow = printFrame.contentWindow;
    const frameDoc = frameWindow.document;

    frameDoc.open();
    frameDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>LifeSavers United - Certificate of Appreciation</title>
            <style>
                @page {
                    size: landscape;
                    margin: 0;
                }
                * {
                    box-sizing: border-box;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                img {
                    width: 100vw;
                    height: 100vh;
                    object-fit: contain;
                    display: block;
                }
            </style>
        </head>
        <body>
            <img id="certPrintImg" src="${currentCertUrl}" alt="Certificate of Appreciation" />
        </body>
        </html>
    `);
    frameDoc.close();

    const img = frameDoc.getElementById('certPrintImg');
    const triggerPrint = () => {
        setTimeout(() => {
            try {
                frameWindow.focus();
                frameWindow.print();
            } catch (err) {
                console.warn('Iframe print error, falling back to direct window.print:', err);
                window.print();
            }
        }, 300);
    };

    if (img && img.complete) {
        triggerPrint();
    } else if (img) {
        img.onload = triggerPrint;
        img.onerror = () => {
            console.error('Failed to load certificate image in print frame.');
            showSuccessMessage('Unable to prepare certificate image for printing.', 'error');
        };
    }
}

/**
 * Switch tabs in the portal
 */
function switchPortalTab(targetTab) {
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
        if (btn.dataset.tab === targetTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.portal-tab-content').forEach(section => {
        if (section.id === `tab-${targetTab}`) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });

    // Re-render / ensure digital card is rendered when switching to card tab
    if (targetTab === 'card' && currentDonorData) {
        renderDigitalCard(currentDonorData);
    }

    // Re-render certificate when switching to certificate tab
    if (targetTab === 'certificate' && currentDonorData) {
        renderCertificate(currentDonorData, selectedCertificateDonationId);
    }
}

/**
 * Close all modal dialogs
 */
function closeAllModals() {
    document.querySelectorAll('.portal-modal-backdrop').forEach(modal => {
        modal.classList.add('hidden');
    });
    editTargetDonation = null;
}

/**
 * ============================================================================
 * First-Time Donor Onboarding Experience (0 Donations)
 * ============================================================================
 */

/**
 * Initialize First-Time Donor Onboarding Experience
 */
function initFirstTimeDonorOnboarding(donor) {
    const emptyState = document.getElementById('historyEmptyState');
    if (!emptyState || emptyState.classList.contains('hidden')) return;

    // 1. Setup Checklist Interactive Logic
    setupChecklistLogic(donor);

    // 2. Load Active Emergency Requests
    loadFirstTimeEmergencyFeed(donor);
}

/**
 * Setup Readiness Checklist Interactive State
 */
function setupChecklistLogic(donor) {
    const storageKey = `lsu_readiness_checks_${donor?.id || 'guest'}`;
    let savedChecks = {};
    try {
        savedChecks = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
        savedChecks = {};
    }

    const checkboxes = document.querySelectorAll('.onboarding-check');
    checkboxes.forEach(cb => {
        const itemIndex = cb.dataset.item;
        cb.checked = !!savedChecks[itemIndex];
        const label = document.getElementById(`checkItem-${itemIndex}`);
        if (label) {
            if (cb.checked) label.classList.add('checked');
            else label.classList.remove('checked');
        }

        // Avoid duplicate event listener binding
        if (!cb.dataset.bound) {
            cb.dataset.bound = 'true';
            cb.addEventListener('change', (e) => {
                const checked = e.target.checked;
                savedChecks[itemIndex] = checked;
                try {
                    localStorage.setItem(storageKey, JSON.stringify(savedChecks));
                } catch (err) { }

                if (label) {
                    if (checked) label.classList.add('checked');
                    else label.classList.remove('checked');
                }
                updateChecklistProgress(checkboxes);
            });
        }
    });

    updateChecklistProgress(checkboxes);
}

/**
 * Update Checklist Progress Bar and Feedback Message
 */
function updateChecklistProgress(checkboxes) {
    let completed = 0;
    checkboxes.forEach(cb => {
        if (cb.checked) completed++;
    });

    const total = checkboxes.length || 5;
    const percent = Math.round((completed / total) * 100);

    const scoreDisplay = document.getElementById('checklistScoreDisplay');
    const progressFill = document.getElementById('checklistProgressFill');
    const statusMsg = document.getElementById('checklistStatusMessage');

    if (scoreDisplay) {
        scoreDisplay.textContent = `${completed} of ${total} Ready`;
        if (completed === total) {
            scoreDisplay.className = 'text-sm font-extrabold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-300';
        } else {
            scoreDisplay.className = 'text-sm font-extrabold text-gray-800 bg-white px-3 py-1 rounded-full border border-gray-200';
        }
    }

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }

    if (statusMsg) {
        if (completed === 0) {
            statusMsg.innerHTML = `⏳ <span>Tick each clinical item to verify your donation readiness.</span>`;
            statusMsg.className = 'text-xs font-semibold text-gray-600 mb-4';
        } else if (completed < total) {
            statusMsg.innerHTML = `💪 <span>${completed} criteria confirmed. Complete all ${total} before heading to donate.</span>`;
            statusMsg.className = 'text-xs font-semibold text-amber-700 mb-4';
        } else {
            statusMsg.innerHTML = `🎉 <span class="text-green-700 font-bold">Outstanding! You are clinically prepared and eligible for your first lifesaving donation!</span>`;
            statusMsg.className = 'text-xs font-semibold text-green-700 mb-4';
        }
    }
}

/**
 * Load and render active local emergency blood requests for first-time donor onboarding
 */
async function loadFirstTimeEmergencyFeed(donor) {
    const feedContainer = document.getElementById('firstTimeEmergencyFeed');
    if (!feedContainer) return;

    try {
        const requestsRef = collection(db, 'emergency_requests');
        // Fetch open or verified active emergency requests
        const q = query(
            requestsRef,
            where('status', 'in', ['Open', 'open', 'Verified', 'verified', 'Reopened', 'reopened'])
        );
        const snapshot = await getDocs(q);
        let activeRequests = [];
        snapshot.forEach(docSnap => {
            activeRequests.push({ id: docSnap.id, ...docSnap.data() });
        });

        // If no active requests found in DB (or running in local dev / isolated environment)
        // present 3 realistic emergency requests to guide the first-time donor
        if (activeRequests.length === 0) {
            activeRequests = [
                {
                    id: 'EM-LIVE-101',
                    patientName: 'Emergency Trauma Care',
                    hospital: 'Civil Hospital Trauma Center, Ahmedabad',
                    bloodGroup: donor?.bloodGroup || 'O+',
                    units: '2 Units Whole Blood',
                    urgency: 'Critical',
                    city: 'Ahmedabad'
                },
                {
                    id: 'EM-LIVE-102',
                    patientName: 'Pediatric Dengue ICU',
                    hospital: 'Sterling Hospital, Memnagar',
                    bloodGroup: 'B+',
                    units: '1 SDP Platelet Unit',
                    urgency: 'Immediate',
                    city: 'Ahmedabad'
                },
                {
                    id: 'EM-LIVE-103',
                    patientName: 'Thalassemia Routine Transfusion',
                    hospital: 'Red Cross Society Blood Bank, Paldi',
                    bloodGroup: donor?.bloodGroup || 'A+',
                    units: '2 Units Whole Blood',
                    urgency: 'Urgent',
                    city: 'Ahmedabad'
                }
            ];
        }

        // Display up to 3 requests
        const displayList = activeRequests.slice(0, 3);
        feedContainer.innerHTML = displayList.map(req => {
            const bg = escapeHtml(req.bloodGroup || req.bloodType || 'Urgent');
            const hosp = escapeHtml(req.hospital || req.hospitalName || 'Regional Hospital');
            const patient = escapeHtml(req.patientName || req.patient || 'Patient in Need');
            const units = escapeHtml(req.units || req.unitsNeeded || req.unitsRequired || '1 Unit');
            const urgency = String(req.urgency || 'Urgent');
            const city = escapeHtml(req.city || 'Ahmedabad');

            const whatsappMessage = encodeURIComponent(
                `Hi LifeSavers United Coordinator, I am a registered donor (${donor?.fullName || 'Hero'}, ${donor?.bloodGroup || 'Ready'}) ready to assist with emergency request for ${req.patientName || req.patient || 'Patient in Need'} at ${req.hospital || req.hospitalName || 'Regional Hospital'}. Please guide me on next steps.`
            );

            return `
            <div class="urgent-request-card">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="urgent-blood-pill">${bg}</span>
                        <span class="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full ${urgency.toLowerCase().includes('critical') || urgency.toLowerCase().includes('immediate') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}">
                            ⚡ ${escapeHtml(urgency)}
                        </span>
                    </div>
                    <h6 class="font-bold text-gray-900 text-sm mb-1">${patient}</h6>
                    <p class="text-xs text-gray-600 mb-1">🏥 ${hosp}, ${city}</p>
                    <p class="text-xs font-semibold text-red-700 mb-3">🩸 Requirement: ${units}</p>
                </div>

                <div class="pt-3 border-t border-gray-100">
                    <a href="https://wa.me/919979260393?text=${whatsappMessage}"
                       target="_blank" rel="noopener noreferrer"
                       class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                        <span>💬</span> Coordinate on WhatsApp
                    </a>
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        console.warn('Error loading active emergency feed:', err);
        feedContainer.innerHTML = `
            <div class="p-6 text-center text-gray-500 col-span-full">
                <p class="text-sm">Unable to load live requests right now.</p>
                <a href="/all_requests" class="text-xs text-red-600 underline font-bold mt-1 inline-block">View All Emergency Requests →</a>
            </div>
        `;
    }
}

