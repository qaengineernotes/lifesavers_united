// Donation Logs Page - Main JavaScript
// Handles fetching, filtering, paginating official volunteer/admin donation logs,
// generating appreciation certificates, and opening 4-tab Donor & Request detail modals.

import { getCurrentUser, onAuthChange } from '/scripts/firebase-auth-service.js';
import { generateDonorCertificate } from '/scripts/donor-certificate-generator.js';
import { toDateObj } from '/scripts/donation-interval-validator.js';
import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    initAppCheck
} from '/scripts/firebase-config.js';

// ============================================================================
// CONSTANTS & STATE
// ============================================================================
const PAGE_SIZE = 10;
const WHATSAPP_COUNTRY_CODE = '91';

let currentUser = null;
let allDonationLogs = [];
let filteredDonationLogs = [];
let currentPage = 1;
let searchQuery = '';

// Local caches to prevent redundant Firestore reads
const donorCache = new Map();
const requestCache = new Map();

let currentViewingDonor = null;
let currentViewingDonations = [];
let currentViewingRequest = null;

// ============================================================================
// INITIALIZE PAGE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth Listener
    onAuthChange(async (user) => {
        currentUser = user;

        if (!user) {
            showAccessDenied('Please log in to view the Donation Logs.');
            return;
        }

        // Only approved volunteers or superusers (admin) can access
        const isApproved = user.status === 'approved';
        const isVolunteerOrAdmin = user.role === 'volunteer' || user.role === 'superuser';

        if (!isApproved || !isVolunteerOrAdmin) {
            showAccessDenied('Access Denied. Only approved LifeSavers United volunteers and administrators can view this page.');
            return;
        }

        // Load logs
        await loadDonationLogs();
    });

    // Close modals on backdrop click or ESC key
    setupModalDismissListeners();
});

// ============================================================================
// SHOW ACCESS DENIED
// ============================================================================
function showAccessDenied(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) statsGrid.style.display = 'none';
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) searchContainer.style.display = 'none';

    const accessDenied = document.getElementById('accessDenied');
    if (accessDenied) {
        accessDenied.style.display = 'block';
        const p = accessDenied.querySelector('p');
        if (p) p.textContent = message;
    }
}

// ============================================================================
// LOAD ALL DONATION LOGS
// ============================================================================
async function loadDonationLogs() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'none';

        // Query donation_logs collection
        const logsRef = collection(db, 'donation_logs');
        const snapshot = await getDocs(logsRef);

        const logs = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // FILTER RULE: Exclude manual donor self-reported logs
            if (data.source === 'donor_self_reported' || data.status === 'self_reported') {
                return;
            }
            logs.push({
                id: docSnap.id,
                ...data
            });
        });

        // Sort descending (latest on top)
        logs.sort((a, b) => {
            const dateA = toDateObj(a.donatedAt || a.timestamp || a.createdAt) || new Date(0);
            const dateB = toDateObj(b.donatedAt || b.timestamp || b.createdAt) || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        allDonationLogs = logs;
        filteredDonationLogs = [...allDonationLogs];

        // Update statistics
        updateStatistics(allDonationLogs);

        // Show UI sections
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('statsGrid').style.display = 'grid';
        document.getElementById('searchContainer').style.display = 'block';
        document.getElementById('tableContainer').style.display = 'block';

        // Initialize search
        initializeSearch();

        // Render Page 1
        currentPage = 1;
        renderTable();
    } catch (error) {
        console.error('Error loading donation logs:', error);
        document.getElementById('loadingState').innerHTML = `
            <div style="color: #dc2626; text-align: center; padding: 30px;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Error Loading Donation Logs</p>
                <p style="color: #6b7280; margin-bottom: 16px;">${escapeHtml(error.message)}</p>
                <button onclick="location.reload()" class="action-btn" style="padding: 10px 24px; border-radius: 8px; background: #dc2626; color: white;">Retry</button>
            </div>
        `;
    }
}

// ============================================================================
// UPDATE STATISTICS
// ============================================================================
function updateStatistics(logs) {
    const total = logs.length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let thisMonthCount = 0;
    let wholeBloodCount = 0;
    let plateletsCount = 0;

    logs.forEach(log => {
        const dDate = toDateObj(log.donatedAt || log.timestamp || log.createdAt);
        if (dDate && dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear) {
            thisMonthCount++;
        }

        const type = (log.donationType || '').toLowerCase();
        if (type.includes('platelet') || type.includes('sdp')) {
            plateletsCount++;
        } else {
            // Default or whole blood
            wholeBloodCount++;
        }
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statThisMonth').textContent = thisMonthCount;
    document.getElementById('statWholeBlood').textContent = wholeBloodCount;
    document.getElementById('statPlatelets').textContent = plateletsCount;
}

// ============================================================================
// SEARCH LOGIC
// ============================================================================
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        if (searchQuery) {
            clearSearch.style.display = 'block';
            filteredDonationLogs = allDonationLogs.filter(log => {
                const donorName = (log.donorName || '').toLowerCase();
                const patientName = (log.patientName || '').toLowerCase();
                const hospital = (log.hospital || log.hospitalName || '').toLowerCase();
                const contact = String(log.donorContact || '').toLowerCase();
                const bloodGroup = (log.bloodGroup || '').toLowerCase();
                return donorName.includes(searchQuery) ||
                       patientName.includes(searchQuery) ||
                       hospital.includes(searchQuery) ||
                       contact.includes(searchQuery) ||
                       bloodGroup.includes(searchQuery);
            });
            searchResults.textContent = `Found ${filteredDonationLogs.length} matching logs`;
        } else {
            clearSearch.style.display = 'none';
            filteredDonationLogs = [...allDonationLogs];
            searchResults.textContent = '';
        }

        currentPage = 1;
        renderTable();
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearch.style.display = 'none';
        searchResults.textContent = '';
        filteredDonationLogs = [...allDonationLogs];
        currentPage = 1;
        renderTable();
    });
}

// ============================================================================
// RENDER TABLE & PAGINATION
// ============================================================================
function renderTable() {
    const tbody = document.getElementById('logsTableBody');
    const emptyNotice = document.getElementById('emptyNotice');
    const paginationContainer = document.getElementById('paginationContainer');

    tbody.innerHTML = '';

    if (filteredDonationLogs.length === 0) {
        emptyNotice.style.display = 'block';
        paginationContainer.style.display = 'none';
        return;
    }

    emptyNotice.style.display = 'none';
    paginationContainer.style.display = 'flex';

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredDonationLogs.length);
    const currentBatch = filteredDonationLogs.slice(startIndex, endIndex);

    currentBatch.forEach((log, idx) => {
        const rowNumber = startIndex + idx + 1;
        const tr = document.createElement('tr');

        // Date
        const dDate = toDateObj(log.donatedAt || log.timestamp || log.createdAt);
        const formattedDate = dDate ? formatDate(dDate) : 'N/A';

        // Donor Name
        const donorName = escapeHtml(log.donorName || 'Donor');
        const donorBlood = log.bloodGroup ? `<span style="background: #fee2e2; color: #dc2626; font-size: 11px; padding: 2px 6px; border-radius: 9999px; font-weight: 700; margin-left: 6px;">🩸 ${escapeHtml(log.bloodGroup)}</span>` : '';

        // Patient Name
        const patientName = escapeHtml(log.patientName || 'Direct / Voluntary Camp');

        // Hospital
        const hospitalName = escapeHtml(log.hospital || log.hospitalName || 'Blood Bank / Hospital');

        // Donation Type Badge
        const typeBadge = formatDonationTypeBadge(log.donationType, log.unitsDonated);

        // Coordinator subtext (who logged it)
        const recordedBy = log.recordedByName || log.createdBy || 'LifeSavers United';

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 700; color: #6b7280;">${rowNumber}</td>
            <td>
                <div style="font-weight: 600; color: #1f2937;">${formattedDate}</div>
                <div style="font-size: 11px; color: #9ca3af;">By ${escapeHtml(recordedBy)}</div>
            </td>
            <td>
                <a href="javascript:void(0)" onclick="openDonorModal('${log.id}', '${log.donorId || ''}')" 
                   class="clickable-link font-semibold text-red-600 hover:text-red-800" 
                   title="Click to view full Donor Details">
                    <span>${donorName}</span>${donorBlood}
                </a>
                ${log.donorContact ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">📞 ${escapeHtml(log.donorContact)}</div>` : ''}
            </td>
            <td>
                <a href="javascript:void(0)" onclick="openRequestModal('${log.id}', '${log.requestId || ''}')" 
                   class="clickable-link font-medium text-blue-600 hover:text-blue-800" 
                   title="Click to view full Emergency Request Details">
                    ${patientName}
                </a>
            </td>
            <td>
                <div style="font-weight: 500; color: #374151;">${hospitalName}</div>
            </td>
            <td>
                ${typeBadge}
            </td>
            <td style="text-align: center;">
                <button id="cert-btn-${log.id}" class="cert-btn" onclick="downloadCertificate('${log.id}')" title="Download Certificate of Appreciation">
                    📜 Certificate
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Update Pagination UI
    renderPagination(startIndex + 1, endIndex, filteredDonationLogs.length);
}

// ============================================================================
// PAGINATION CONTROLS
// ============================================================================
function renderPagination(startRecord, endRecord, totalRecords) {
    const infoEl = document.getElementById('paginationInfo');
    const controlsEl = document.getElementById('paginationControls');

    infoEl.textContent = `Showing ${startRecord} to ${endRecord} of ${totalRecords} donation${totalRecords !== 1 ? 's' : ''}`;

    const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;
    controlsEl.innerHTML = '';

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '« Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            window.scrollTo({ top: 350, behavior: 'smooth' });
        }
    };
    controlsEl.appendChild(prevBtn);

    // Numbered Buttons (Dynamic window)
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage - startPage < maxPageButtons - 1) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (startPage > 1) {
        const firstBtn = createPageBtn(1);
        controlsEl.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 4px';
            ellipsis.style.color = '#9ca3af';
            controlsEl.appendChild(ellipsis);
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        controlsEl.appendChild(createPageBtn(p));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 4px';
            ellipsis.style.color = '#9ca3af';
            controlsEl.appendChild(ellipsis);
        }
        const lastBtn = createPageBtn(totalPages);
        controlsEl.appendChild(lastBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = 'Next »';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            window.scrollTo({ top: 350, behavior: 'smooth' });
        }
    };
    controlsEl.appendChild(nextBtn);
}

function createPageBtn(pageNum) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${pageNum === currentPage ? 'active' : ''}`;
    btn.textContent = pageNum;
    btn.onclick = () => {
        currentPage = pageNum;
        renderTable();
        window.scrollTo({ top: 350, behavior: 'smooth' });
    };
    return btn;
}

// ============================================================================
// FORMAT DONATION TYPE BADGE
// ============================================================================
function formatDonationTypeBadge(typeStr, units) {
    const raw = (typeStr || '').toLowerCase();
    const unitText = units ? ` (${units} unit${units > 1 ? 's' : ''})` : '';

    if (raw.includes('platelet') || raw.includes('sdp')) {
        return `<span class="donation-type-badge type-platelets">🧪 Platelets SDP${unitText}</span>`;
    }
    if (raw.includes('plasma')) {
        return `<span class="donation-type-badge type-plasma">💧 Plasma${unitText}</span>`;
    }
    if (raw.includes('whole')) {
        return `<span class="donation-type-badge type-whole-blood">🩸 Whole Blood${unitText}</span>`;
    }
    return `<span class="donation-type-badge type-default">🩸 Blood Donation${unitText}</span>`;
}

// ============================================================================
// CERTIFICATE GENERATION & DOWNLOAD
// ============================================================================
function computeCertificateNumber(donation, allDonations) {
    let year = new Date().getFullYear();
    let seq = 1;

    if (donation) {
        const dDate = toDateObj(donation.donatedAt || donation.timestamp || donation.createdAt);
        if (dDate && !isNaN(dDate.getTime())) {
            year = dDate.getFullYear();
        }

        const chronological = [...(allDonations || [])].sort((a, b) => {
            const timeA = (toDateObj(a.donatedAt || a.timestamp || a.createdAt) || new Date(0)).getTime();
            const timeB = (toDateObj(b.donatedAt || b.timestamp || b.createdAt) || new Date(0)).getTime();
            return timeA - timeB;
        });

        const sameYearDonations = chronological.filter(d => {
            const date = toDateObj(d.donatedAt || d.timestamp || d.createdAt);
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

window.downloadCertificate = async function (donationId) {
    const btn = document.getElementById(`cert-btn-${donationId}`);
    const originalText = btn ? btn.innerHTML : '📜 Certificate';

    try {
        const donation = allDonationLogs.find(d => String(d.id || '').trim() === String(donationId).trim());
        if (!donation) {
            console.error('Donation record not found:', donationId);
            return;
        }

        if (btn) {
            btn.innerHTML = '⏳ Generating...';
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.7';
        }

        const certNo = computeCertificateNumber(donation, allDonationLogs);
        const dDate = toDateObj(donation.donatedAt || donation.timestamp || donation.createdAt) || new Date();
        const hospitalName = donation.hospital || donation.hospitalName || 'Voluntary Camp / Blood Center';
        const donorName = donation.donorName || 'Valued Donor';
        const bloodGroup = donation.bloodGroup || 'O+';

        const blob = await generateDonorCertificate({
            name: donorName,
            bloodGroup: bloodGroup,
            hospital: hospitalName,
            patientName: donation.patientName || '',
            donationDate: dDate,
            certificateNo: certNo
        });

        const safeName = donorName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeCertNo = (certNo || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = safeCertNo
            ? `LifeSavers_Certificate_${safeName}_${safeCertNo}.png`
            : `LifeSavers_Certificate_${safeName}.png`;

        const link = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        link.download = fileName;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
        console.error('Failed to generate certificate:', err);
        alert('Could not generate the certificate. Please check console for details.');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.style.pointerEvents = '';
            btn.style.opacity = '1';
        }
    }
};

// ============================================================================
// 👤 DONOR DETAIL POPUP (4 TABS)
// ============================================================================
window.openDonorModal = async function (logId, donorId) {
    const donation = allDonationLogs.find(d => d.id === logId);
    let donor = null;

    try {
        if (donorId && donorId !== 'none') {
            if (donorCache.has(donorId)) {
                donor = donorCache.get(donorId);
            } else {
                const donorSnap = await getDoc(doc(db, 'donors', donorId));
                if (donorSnap.exists()) {
                    donor = { id: donorSnap.id, ...donorSnap.data() };
                    donorCache.set(donorId, donor);
                }
            }
        }

        // If donor not in collection or no donorId, build from log
        if (!donor) {
            donor = {
                id: donorId || 'temp_donor_' + logId,
                fullName: donation?.donorName || 'Anonymous Donor',
                contactNumber: donation?.donorContact || '',
                bloodGroup: donation?.bloodGroup || 'N/A',
                city: 'N/A',
                isEmergencyAvailable: 'Yes',
                registeredAt: donation?.donatedAt || donation?.createdAt || new Date()
            };
        }

        currentViewingDonor = donor;

        // Populate 4 Tabs
        document.getElementById('donorTab-overview').innerHTML = createDonorOverviewTab(donor);
        document.getElementById('donorTab-personal').innerHTML = createDonorPersonalTab(donor);
        document.getElementById('donorTab-medical').innerHTML = createDonorMedicalTab(donor);

        // Fetch past donations for this donor
        const pastDonations = await fetchDonorDonations(donor);
        currentViewingDonations = pastDonations;
        document.getElementById('donorTab-donations').innerHTML = createDonorDonationsTab(donor, pastDonations);

        // Default to Overview tab
        switchDonorTab('overview');

        // Show Modal
        document.getElementById('donorModal').classList.add('active');
    } catch (err) {
        console.error('Error opening donor details:', err);
        alert('Could not load donor details: ' + err.message);
    }
};

window.switchDonorTab = function (tabName) {
    ['overview', 'personal', 'medical', 'donations'].forEach(t => {
        const btn = document.getElementById(`donorTabBtn-${t}`);
        const content = document.getElementById(`donorTab-${t}`);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (content) content.classList.toggle('active', t === tabName);
    });
};

function createDonorOverviewTab(donor) {
    const isEmergency = String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes';
    const regDate = donor.registeredAt || donor.createdAt;

    return `
        <div class="info-card" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; margin-bottom: 20px;">
            <h3 style="color: rgba(255,255,255,0.85); margin-bottom: 12px; font-size: 18px;">👤 ${escapeHtml(donor.fullName || 'Valued Donor')}</h3>
            <div class="info-fields-grid cols-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <div class="info-field" style="background:rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Blood Group</div>
                    <div style="color:#fff; font-size:22px; font-weight: 800;">🩸 ${donor.bloodGroup || 'N/A'}</div>
                </div>
                <div class="info-field" style="background:rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Contact</div>
                    <div style="color:#fff; font-weight: 700; font-size: 15px;">${donor.contactNumber || 'N/A'}</div>
                </div>
                <div class="info-field" style="background:rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Emergency Availability</div>
                    <div style="font-weight: 700; color: ${isEmergency ? '#86efac' : '#fca5a5'};">${isEmergency ? '✓ Ready to Donate' : '✗ Busy / Deferral'}</div>
                </div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 20px;">
            <h3>📍 Location & City</h3>
            <div class="info-row">
                <div class="info-label">City:</div>
                <div class="info-value"><strong>${escapeHtml(donor.city || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Area / Landmark:</div>
                <div class="info-value">${escapeHtml(donor.area || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Registered On:</div>
                <div class="info-value">${regDate ? formatDate(toDateObj(regDate)) : 'N/A'}</div>
            </div>
        </div>
    `;
}

function createDonorPersonalTab(donor) {
    const contact = donor.contactNumber || '';
    return `
        <div class="info-card" style="margin-bottom: 20px;">
            <h3>👤 Personal Information</h3>
            <div class="info-row">
                <div class="info-label">Full Name:</div>
                <div class="info-value"><strong>${escapeHtml(donor.fullName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Age:</div>
                <div class="info-value">${donor.age ? donor.age + ' yrs' : 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Gender:</div>
                <div class="info-value">${donor.gender || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Weight:</div>
                <div class="info-value">${donor.weight ? donor.weight + ' kg' : 'N/A'}</div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 20px;">
            <h3>📞 Contact Methods</h3>
            <div class="info-row">
                <div class="info-label">Phone:</div>
                <div class="info-value">
                    <strong>${contact || 'N/A'}</strong>
                    ${contact ? `
                        <div style="margin-top: 6px;">
                            <a href="tel:${contact}" style="color: #dc2626; font-weight: 700; margin-right: 12px; text-decoration: none;">📞 Call Now</a>
                            <a href="https://wa.me/${WHATSAPP_COUNTRY_CODE}${contact.replace(/\D/g, '').slice(-10)}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 700; text-decoration: none;">💬 WhatsApp</a>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">${donor.email ? `<a href="mailto:${donor.email}" style="color: #2563eb;">${escapeHtml(donor.email)}</a>` : 'N/A'}</div>
            </div>
        </div>
    `;
}

function createDonorMedicalTab(donor) {
    const isEmergency = String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes';

    return `
        <div class="info-card" style="margin-bottom: 20px;">
            <h3>🩸 Medical Profile & Blood Details</h3>
            <div class="info-row">
                <div class="info-label">Blood Group:</div>
                <div class="info-value"><strong style="color: #dc2626; font-size: 18px;">🩸 ${donor.bloodGroup || 'N/A'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Emergency Readiness:</div>
                <div class="info-value"><strong style="color: ${isEmergency ? '#059669' : '#dc2626'};">${isEmergency ? '✓ Verified Active' : '✗ Deferral / Paused'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Last Donated:</div>
                <div class="info-value">${donor.lastDonatedAt ? formatDate(toDateObj(donor.lastDonatedAt)) : 'No prior logged date'}</div>
            </div>
            <div class="info-row" style="grid-template-columns: 1fr;">
                <div>
                    <div class="info-label" style="margin-bottom: 6px;">Medical Notes / Deferral History:</div>
                    <div class="info-value" style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
                        ${escapeHtml(donor.medicalHistory || donor.notes || 'No active medical conditions or permanent deferrals recorded.')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function fetchDonorDonations(donor) {
    if (!donor) return [];
    try {
        const cleanPhone = donor.contactNumber ? String(donor.contactNumber).replace(/\D/g, '').slice(-10) : '';

        // Query by donorId or donorContact
        return allDonationLogs.filter(log => {
            if (donor.id && log.donorId === donor.id) return true;
            if (cleanPhone && log.donorContact && String(log.donorContact).replace(/\D/g, '').slice(-10) === cleanPhone) return true;
            return false;
        });
    } catch (e) {
        console.error('Error fetching donor donations:', e);
        return [];
    }
}

function createDonorDonationsTab(donor, donations) {
    if (!donations || donations.length === 0) {
        return `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 10px;">📋</div>
                <p style="font-weight: 600; color: #374151;">No Coordinated Donation Logs Found</p>
                <p style="font-size: 13px;">This donor does not have any recorded donations in this cycle.</p>
            </div>
        `;
    }

    const rows = donations.map((d, i) => {
        const dateStr = formatDate(toDateObj(d.donatedAt || d.timestamp || d.createdAt));
        const hospitalStr = escapeHtml(d.hospital || d.hospitalName || 'Voluntary Camp');
        const patientStr = escapeHtml(d.patientName || 'Direct / Camp');

        return `
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; font-weight: 700; color: #6b7280;">#${i + 1}</td>
                <td style="padding: 10px; font-weight: 600;">${dateStr}</td>
                <td style="padding: 10px;">${patientStr}</td>
                <td style="padding: 10px;">${hospitalStr}</td>
                <td style="padding: 10px; text-align: center;">
                    <button class="cert-btn" style="padding: 4px 10px; font-size: 12px;" onclick="downloadCertificate('${d.id}')">
                        📜 Download
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-wrapper" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <tr>
                        <th style="padding: 10px; text-align: left;">#</th>
                        <th style="padding: 10px; text-align: left;">Date</th>
                        <th style="padding: 10px; text-align: left;">Patient</th>
                        <th style="padding: 10px; text-align: left;">Hospital</th>
                        <th style="padding: 10px; text-align: center;">Certificate</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================================
// 📋 REQUEST DETAIL POPUP (4 TABS)
// ============================================================================
window.openRequestModal = async function (logId, requestId) {
    const donation = allDonationLogs.find(d => d.id === logId);
    let request = null;

    try {
        if (requestId && requestId !== 'none') {
            if (requestCache.has(requestId)) {
                request = requestCache.get(requestId);
            } else {
                const reqSnap = await getDoc(doc(db, 'emergency_requests', requestId));
                if (reqSnap.exists()) {
                    request = { id: reqSnap.id, ...reqSnap.data() };
                    requestCache.set(requestId, request);
                }
            }
        }

        // If request not found or direct voluntary camp
        if (!request) {
            request = {
                id: requestId || 'Direct Camp / Voluntary',
                patientName: donation?.patientName || 'Direct / Voluntary Camp',
                hospitalName: donation?.hospital || donation?.hospitalName || 'Voluntary Camp',
                bloodType: donation?.bloodGroup || 'All Groups',
                unitsRequired: donation?.unitsDonated || 1,
                unitsFulfilled: donation?.unitsDonated || 1,
                status: 'Fulfilled',
                urgency: 'Normal',
                city: 'Ahmedabad',
                inquiryDate: donation?.donatedAt || donation?.createdAt || new Date(),
                isDirectCamp: true
            };
        }

        currentViewingRequest = request;

        // Overview Tab
        document.getElementById('reqTab-overview').innerHTML = createRequestOverviewTab(request);

        // Details Tab
        document.getElementById('reqTab-details').innerHTML = createRequestDetailsTab(request);

        // Donations Tab
        const relatedDonations = allDonationLogs.filter(l => l.requestId && l.requestId === request.id);
        document.getElementById('reqTab-donations').innerHTML = createRequestDonationsTab(request, relatedDonations.length ? relatedDonations : [donation]);

        // History Tab
        document.getElementById('reqTab-history').innerHTML = createRequestHistoryTab(request);

        // Default to Overview tab
        switchRequestTab('overview');

        // Show Modal
        document.getElementById('requestModal').classList.add('active');
    } catch (err) {
        console.error('Error opening request details:', err);
        alert('Could not load request details: ' + err.message);
    }
};

window.switchRequestTab = function (tabName) {
    ['overview', 'details', 'donations', 'history'].forEach(t => {
        const btn = document.getElementById(`reqTabBtn-${t}`);
        const content = document.getElementById(`reqTab-${t}`);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (content) content.classList.toggle('active', t === tabName);
    });
};

function createRequestOverviewTab(request) {
    const unitsRequired = parseInt(request.unitsRequired) || 0;
    const unitsFulfilled = parseInt(request.unitsFulfilled) || 0;
    const percentage = unitsRequired > 0 ? Math.min(100, Math.round((unitsFulfilled / unitsRequired) * 100)) : 100;
    const reqDate = request.inquiryDate || request.createdAt;

    return `
        <div class="info-card" style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 12px; font-size: 18px;">
                <span class="status-badge" style="background: rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 9999px;">
                    ${(request.status || 'FULFILLED').toUpperCase()}
                </span>
            </h3>
            <div style="font-size: 13px; line-height: 1.6; opacity: 0.9;">
                <div><strong>Request ID:</strong> ${escapeHtml(request.id)}</div>
                <div><strong>Recorded On:</strong> ${reqDate ? formatDate(toDateObj(reqDate)) : 'N/A'}</div>
                <div><strong>Urgency:</strong> ${escapeHtml(request.urgency || 'Standard')}</div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 20px;">
            <h3>🩸 Blood Requirement Progress</h3>
            <div class="info-row">
                <div class="info-label">Blood Group:</div>
                <div class="info-value"><strong style="color: #dc2626; font-size: 18px;">${escapeHtml(request.bloodType || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Units Needed:</div>
                <div class="info-value"><strong>${unitsRequired} Units</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Units Fulfilled:</div>
                <div class="info-value"><strong style="color: #059669;">${unitsFulfilled} Units</strong></div>
            </div>
            <div style="margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 5px;">
                    <span>Fulfillment Progress</span>
                    <strong style="color: #111827;">${percentage}%</strong>
                </div>
                <div class="progress-bar" style="height: 10px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                    <div style="height: 100%; width: ${percentage}%; background: ${percentage >= 100 ? '#10b981' : '#f59e0b'}; transition: width 0.3s ease;"></div>
                </div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 20px;">
            <h3>🏥 Hospital & Patient Summary</h3>
            <div class="info-row">
                <div class="info-label">Patient:</div>
                <div class="info-value"><strong>${escapeHtml(request.patientName || 'N/A')}</strong> (${request.patientAge ? request.patientAge + ' yrs' : 'Age N/A'})</div>
            </div>
            <div class="info-row">
                <div class="info-label">Hospital:</div>
                <div class="info-value"><strong>${escapeHtml(request.hospitalName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">City:</div>
                <div class="info-value">${escapeHtml(request.city || 'N/A')}</div>
            </div>
        </div>
    `;
}

function createRequestDetailsTab(request) {
    const contact = request.contactNumber || '';
    return `
        <div class="info-card" style="margin-bottom: 20px;">
            <h3>👤 Complete Patient Information</h3>
            <div class="info-row">
                <div class="info-label">Patient Name:</div>
                <div class="info-value"><strong>${escapeHtml(request.patientName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Age & Gender:</div>
                <div class="info-value">${request.patientAge || 'N/A'} yrs • ${request.gender || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Diagnosis / Condition:</div>
                <div class="info-value">${escapeHtml(request.diagnosis || request.medicalCondition || 'No specific diagnosis notes provided')}</div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 20px;">
            <h3>🏥 Hospital Details & Contact</h3>
            <div class="info-row">
                <div class="info-label">Hospital:</div>
                <div class="info-value"><strong>${escapeHtml(request.hospitalName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Address & City:</div>
                <div class="info-value">${escapeHtml(request.hospitalAddress || request.city || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Person:</div>
                <div class="info-value">${escapeHtml(request.contactPerson || request.attendantName || 'Family Attendant')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Number:</div>
                <div class="info-value">
                    <strong>${contact || 'N/A'}</strong>
                    ${contact ? `
                        <div style="margin-top: 6px;">
                            <a href="tel:${contact}" style="color: #2563eb; font-weight: 700; margin-right: 12px; text-decoration: none;">📞 Call Attendant</a>
                            <a href="https://wa.me/${WHATSAPP_COUNTRY_CODE}${contact.replace(/\D/g, '').slice(-10)}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 700; text-decoration: none;">💬 WhatsApp</a>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function createRequestDonationsTab(request, donations) {
    if (!donations || donations.length === 0) {
        return `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <p>No fulfilled donations recorded specifically under this request.</p>
            </div>
        `;
    }

    const rows = donations.map((d, i) => {
        const dateStr = formatDate(toDateObj(d.donatedAt || d.timestamp || d.createdAt));
        const donorName = escapeHtml(d.donorName || 'LifeSavers Donor');
        const units = d.unitsDonated || 1;

        return `
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; font-weight: 700; color: #6b7280;">#${i + 1}</td>
                <td style="padding: 10px; font-weight: 600;">${dateStr}</td>
                <td style="padding: 10px; font-weight: 600; color: #dc2626;">${donorName}</td>
                <td style="padding: 10px;">${units} unit${units > 1 ? 's' : ''}</td>
                <td style="padding: 10px; text-align: center;">
                    <button class="cert-btn" style="padding: 4px 10px; font-size: 12px;" onclick="downloadCertificate('${d.id}')">
                        📜 Certificate
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-wrapper" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <tr>
                        <th style="padding: 10px; text-align: left;">#</th>
                        <th style="padding: 10px; text-align: left;">Date</th>
                        <th style="padding: 10px; text-align: left;">Donor Name</th>
                        <th style="padding: 10px; text-align: left;">Units</th>
                        <th style="padding: 10px; text-align: center;">Certificate</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function createRequestHistoryTab(request) {
    return `
        <div class="info-card" style="margin-bottom: 20px;">
            <h3>📊 Request Coordination Audit</h3>
            <div class="info-row">
                <div class="info-label">Created By:</div>
                <div class="info-value">👤 ${escapeHtml(request.createdBy || 'Coordinator / Web')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Verified By:</div>
                <div class="info-value">${request.verifiedBy ? '✅ ' + escapeHtml(request.verifiedBy) : '✅ Coordinator Verified'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Current Status:</div>
                <div class="info-value"><strong>${escapeHtml(request.status || 'Fulfilled')}</strong></div>
            </div>
            ${request.donorSummary ? `
                <div class="info-row" style="grid-template-columns: 1fr;">
                    <div>
                        <div class="info-label" style="margin-bottom: 6px;">Donors Summary:</div>
                        <div class="info-value" style="background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb;">
                            ${escapeHtml(request.donorSummary)}
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================================
// MODAL CLOSE & DISMISS LOGIC
// ============================================================================
window.closeAllModals = function () {
    document.getElementById('donorModal')?.classList.remove('active');
    document.getElementById('requestModal')?.classList.remove('active');
};

function setupModalDismissListeners() {
    ['donorModal', 'requestModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAllModals();
                }
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ============================================================================
// UTILITIES
// ============================================================================
function formatDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = dateObj.getDate();
    const m = months[dateObj.getMonth()];
    const y = dateObj.getFullYear();
    return `${d} ${m} ${y}`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
