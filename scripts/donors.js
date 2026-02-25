// All Donors Page - Main JavaScript
// Handles authentication, data fetching, table rendering, filtering, and modal display

import { getCurrentUser, isAuthenticated, onAuthChange } from '/scripts/firebase-auth-service.js';
import { db, collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from '/scripts/firebase-config.js';

// ============================================================================
// SUPERUSER CHECK
// ============================================================================
function isSuperuser() {
    return currentUser && currentUser.role === 'superuser';
}

// Global state
let currentUser = null;
let allDonors = [];
let filteredDonors = []; // For search and filter results
let searchQuery = ''; // Current search query
let activeFilters = {
    bloodGroup: '',
    city: '',
    emergency: ''
};
let currentPage = 1;
const donorsPerPage = 20;

// ============================================================================
// INITIALIZE PAGE
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Listen for auth state changes
    onAuthChange(async (user) => {
        currentUser = user;

        if (!user) {
            // User not logged in
            showAccessDenied('Please log in to view this page.');
            return;
        }

        if (user.status !== 'approved') {
            // User not approved
            showAccessDenied('Your account is pending approval. Only approved users can view all donors.');
            return;
        }

        // User is logged in and approved
        await loadAllDonors();
    });
});

// ============================================================================
// SHOW ACCESS DENIED
// ============================================================================
function showAccessDenied(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    const accessDenied = document.getElementById('accessDenied');
    accessDenied.style.display = 'block';
    accessDenied.querySelector('p').textContent = message;
}

// ============================================================================
// LOAD ALL DONORS
// ============================================================================
async function loadAllDonors() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'none';

        const donorsRef = collection(db, 'donors');
        // Don't use orderBy in query - it excludes documents without that field
        // We'll sort in memory instead to include all donors
        const snapshot = await getDocs(donorsRef);

        allDonors = [];
        snapshot.forEach((doc) => {
            allDonors.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort in memory by lastDonatedAt first, then registeredAt/createdAt (fallback)
        allDonors.sort((a, b) => {
            const getTimestamp = (donor) => {
                // Priority 1: Last donation date (most important - shows active donors first)
                const lastDonated = donor.lastDonatedAt;
                if (lastDonated) {
                    return lastDonated.seconds ? lastDonated.seconds : new Date(lastDonated).getTime() / 1000;
                }

                // Priority 2: Registration date (for donors who haven't donated yet)
                const regAt = donor.registeredAt;
                const createdAt = donor.createdAt;

                if (regAt) {
                    return regAt.seconds ? regAt.seconds : new Date(regAt).getTime() / 1000;
                } else if (createdAt) {
                    return createdAt.seconds ? createdAt.seconds : new Date(createdAt).getTime() / 1000;
                }
                return 0;
            };

            return getTimestamp(b) - getTimestamp(a); // Descending order (newest first)
        });

        // Update statistics
        updateStatistics();

        // Populate city filter
        populateCityFilter();

        // Render first page
        currentPage = 1;
        renderTable();

        // Show table and controls
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'block';

        // Initialize search and filters (combined)
        initializeSearchAndFilters();

    } catch (error) {
        console.error('Error loading donors:', error);
        document.getElementById('loadingState').innerHTML = `
            <div style="color: #dc2626;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Error Loading Donors</p>
                <p style="color: #6b7280;">${error.message}</p>
                <button onclick="location.reload()" class="action-btn" style="margin-top: 20px;">Retry</button>
            </div>
        `;
    }
}

// ============================================================================
// UPDATE STATISTICS
// ============================================================================
function updateStatistics() {
    const total = allDonors.length;

    // Emergency available count
    const emergencyCount = allDonors.filter(d =>
        String(d.isEmergencyAvailable || '').toLowerCase() === 'yes'
    ).length;

    // Active donors (donated in last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const activeCount = allDonors.filter(d => {
        if (!d.lastDonatedAt) return false;
        const lastDonation = d.lastDonatedAt.seconds
            ? new Date(d.lastDonatedAt.seconds * 1000)
            : new Date(d.lastDonatedAt);
        return lastDonation >= sixMonthsAgo;
    }).length;

    // New this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const newThisMonth = allDonors.filter(d => {
        // Use registeredAt if available, otherwise use createdAt
        const regDate = d.registeredAt || d.createdAt;
        if (!regDate) return false;
        const dateObj = regDate.seconds
            ? new Date(regDate.seconds * 1000)
            : new Date(regDate);
        return dateObj >= thisMonth;
    }).length;

    // Most common blood group
    const bloodGroups = {};
    allDonors.forEach(d => {
        const bg = d.bloodGroup || 'Unknown';
        bloodGroups[bg] = (bloodGroups[bg] || 0) + 1;
    });
    const mostCommon = Object.keys(bloodGroups).reduce((a, b) =>
        bloodGroups[a] > bloodGroups[b] ? a : b, 'N/A'
    );

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statEmergency').textContent = emergencyCount;
    document.getElementById('statActive').textContent = activeCount;
    document.getElementById('statThisMonth').textContent = newThisMonth;
    document.getElementById('statCommonBlood').textContent = mostCommon;
}

// ============================================================================
// POPULATE CITY FILTER
// ============================================================================
function populateCityFilter() {
    const cities = new Set();
    allDonors.forEach(donor => {
        if (donor.city) {
            cities.add(donor.city);
        }
    });

    const cityFilter = document.getElementById('filterCity');
    const sortedCities = Array.from(cities).sort();

    sortedCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable() {
    const tbody = document.getElementById('donorsTableBody');
    tbody.innerHTML = '';

    // Apply filters and search
    let donorsToDisplay = allDonors;

    // Apply search
    if (searchQuery) {
        donorsToDisplay = donorsToDisplay.filter(donor => {
            const name = String(donor.fullName || '').toLowerCase();
            const contact = String(donor.contactNumber || '').toLowerCase();
            const city = String(donor.city || '').toLowerCase();

            return name.includes(searchQuery) ||
                contact.includes(searchQuery) ||
                city.includes(searchQuery);
        });
    }

    // Apply filters
    if (activeFilters.bloodGroup) {
        donorsToDisplay = donorsToDisplay.filter(d => d.bloodGroup === activeFilters.bloodGroup);
    }
    if (activeFilters.city) {
        donorsToDisplay = donorsToDisplay.filter(d => d.city === activeFilters.city);
    }
    if (activeFilters.emergency) {
        const emergencyValue = activeFilters.emergency === 'yes' ? 'yes' : 'no';
        donorsToDisplay = donorsToDisplay.filter(d =>
            String(d.isEmergencyAvailable || '').toLowerCase() === emergencyValue
        );
    }

    filteredDonors = donorsToDisplay;

    // Calculate pagination
    const startIndex = (currentPage - 1) * donorsPerPage;
    const endIndex = startIndex + donorsPerPage;
    const pageDonors = donorsToDisplay.slice(startIndex, endIndex);

    if (pageDonors.length === 0) {
        const message = searchQuery || hasActiveFilters()
            ? 'No donors found matching your search/filters'
            : 'No donors found';
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: #6b7280;">
                    ${message}
                </td>
            </tr>
        `;
        return;
    }

    // Render each donor
    pageDonors.forEach((donor, index) => {
        const row = createTableRow(donor, startIndex + index);
        tbody.appendChild(row);
    });

    // Update pagination
    updatePagination();

    // Update filter results
    updateFilterResults();
}

// ============================================================================
// CREATE TABLE ROW
// ============================================================================
function createTableRow(donor, index) {
    const tr = document.createElement('tr');

    // 1. Donor Name
    const donorName = escapeHtml(donor.fullName || 'Unknown');

    // 2. Blood Group
    const bloodGroup = `<strong style="color: #dc2626;">🩸 ${donor.bloodGroup || 'N/A'}</strong>`;

    // 3. Contact
    const contact = donor.contactNumber || 'N/A';
    const contactHtml = `
        <div>
            ${contact}
            ${contact !== 'N/A' ? '<br><small style="color: #6b7280;">📞</small>' : ''}
        </div>
    `;

    // 4. City
    const city = `📍 ${escapeHtml(donor.city || 'N/A')}`;

    // 5. Area
    const area = escapeHtml(donor.area || 'N/A');

    // 6. Age
    const age = donor.age || 'N/A';

    // 7. Gender
    const genderIcon = donor.gender === 'Male' ? '👨' : donor.gender === 'Female' ? '👩' : '👤';
    const gender = `${genderIcon} ${donor.gender || 'N/A'}`;

    // 8. Last Donated
    const lastDonated = donor.lastDonatedAt
        ? `<div>${formatDateTime(donor.lastDonatedAt)}<br><small style="color: #6b7280;">${getTimeAgo(donor.lastDonatedAt)}</small></div>`
        : '<span style="color: #9ca3af;">Never</span>';

    // 9. Emergency Available
    const isEmergency = String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes';
    const emergencyBadge = isEmergency
        ? '<span class="status-badge open">✓ YES</span>'
        : '<span class="status-badge closed">✗ NO</span>';

    // 10. Registered Date (use registeredAt or createdAt as fallback)
    const regDate = donor.registeredAt || donor.createdAt;
    const registered = regDate
        ? `\u003cdiv\u003e${formatDateTime(regDate)}\u003cbr\u003e\u003csmall style=\"color: #6b7280;\"\u003e${getTimeAgo(regDate)}\u003c/small\u003e\u003c/div\u003e`
        : 'N/A';

    // 11. Registered By
    const registeredBy = `👤 ${escapeHtml(donor.createdBy || 'Unknown')}`;

    // 12. Actions
    const donorId = donor.id;
    const superuserActions = isSuperuser() ? `
        <button class="action-btn action-btn--edit" onclick="editDonor('${donorId}')" title="Edit Donor">
            ✏️ Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteDonor('${donorId}')" title="Delete Donor">
            🗑️ Delete
        </button>
    ` : '';

    const actionsHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="action-btn" onclick="viewDonor('${donorId}')" title="View Details">
                👁️ View
            </button>
            ${superuserActions}
        </div>
    `;

    tr.innerHTML = `
        <td>${donorName}</td>
        <td>${bloodGroup}</td>
        <td>${contactHtml}</td>
        <td>${city}</td>
        <td>${area}</td>
        <td>${age}</td>
        <td>${gender}</td>
        <td>${lastDonated}</td>
        <td>${emergencyBadge}</td>
        <td>${registered}</td>
        <td><small>${registeredBy}</small></td>
        <td>${actionsHtml}</td>
    `;

    return tr;
}

// ============================================================================
// VIEW DONOR DETAILS
// ============================================================================
window.viewDonor = function (donorId) {
    // Look up by stable Firestore document ID — never stale, no index offset math
    let donor = filteredDonors.find(d => d.id === donorId);
    if (!donor) {
        // Fallback: donor may have been filtered out since the row was rendered
        donor = allDonors.find(d => d.id === donorId);
    }
    if (!donor) {
        console.error('Donor not found:', donorId);
        return;
    }
    populateModal(donor);
    document.getElementById('viewModal').classList.add('active');
};

// ============================================================================
// POPULATE MODAL
// ============================================================================
async function populateModal(donor) {
    // Overview Tab
    const overview = document.getElementById('tabOverview');
    overview.innerHTML = createOverviewTab(donor);

    // Personal Details Tab
    const personal = document.getElementById('tabPersonal');
    personal.innerHTML = createPersonalTab(donor);

    // Medical Info Tab
    const medical = document.getElementById('tabMedical');
    medical.innerHTML = createMedicalTab(donor);

    // Donations Tab
    const donations = document.getElementById('tabDonations');
    const donationHistory = await fetchDonationHistory(donor);
    donations.innerHTML = createDonationsTab(donor, donationHistory);
}

// ============================================================================
// MODAL TAB CONTENT CREATORS
// ============================================================================
function createOverviewTab(donor) {
    const isEmergency = String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes';

    return `
        <div class="info-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <h3 style="color: white;">👤 ${escapeHtml(donor.fullName || 'Unknown')}</h3>
            <div class="info-row">
                <div class="info-label">Blood Group:</div>
                <div class="info-value"><strong style="font-size: 24px;">🩸 ${donor.bloodGroup || 'N/A'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact:</div>
                <div class="info-value"><strong>${donor.contactNumber || 'N/A'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Emergency Available:</div>
                <div class="info-value"><strong>${isEmergency ? '✓ YES' : '✗ NO'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Registered:</div>
                <div class="info-value">${formatDateTime(donor.registeredAt || donor.createdAt)}</div>
            </div>
        </div>

        <div class="info-card">
            <h3>📍 Location</h3>
            <div class="info-row">
                <div class="info-label">City:</div>
                <div class="info-value">${escapeHtml(donor.city || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Area:</div>
                <div class="info-value">${escapeHtml(donor.area || 'N/A')}</div>
            </div>
        </div>
    `;
}

function createPersonalTab(donor) {
    return `
        <div class="info-card">
            <h3>👤 Personal Information</h3>
            <div class="info-row">
                <div class="info-label">Full Name:</div>
                <div class="info-value"><strong>${escapeHtml(donor.fullName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Age:</div>
                <div class="info-value">${donor.age || 'N/A'} years</div>
            </div>
            <div class="info-row">
                <div class="info-label">Gender:</div>
                <div class="info-value">${donor.gender || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Date of Birth:</div>
                <div class="info-value">${donor.dateOfBirth || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Weight:</div>
                <div class="info-value">${donor.weight || 'N/A'} kg</div>
            </div>
        </div>

        <div class="info-card">
            <h3>📞 Contact Information</h3>
            <div class="info-row">
                <div class="info-label">Phone:</div>
                <div class="info-value">
                    <strong>${donor.contactNumber || 'N/A'}</strong>
                    ${donor.contactNumber ? `<br><a href="tel:${donor.contactNumber}" style="color: #667eea;">📞 Call</a> | <a href="https://wa.me/91${donor.contactNumber}" target="_blank" style="color: #25D366;">💬 WhatsApp</a>` : ''}
                </div>
            </div>
            <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">${donor.email || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Preferred Contact:</div>
                <div class="info-value">${donor.preferredContact || 'N/A'}</div>
            </div>
        </div>

        <div class="info-card">
            <h3>📍 Address</h3>
            <div class="info-row">
                <div class="info-label">City:</div>
                <div class="info-value">${escapeHtml(donor.city || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Area:</div>
                <div class="info-value">${escapeHtml(donor.area || 'N/A')}</div>
            </div>
        </div>
    `;
}

function createMedicalTab(donor) {
    return `
        <div class="info-card">
            <h3>🩸 Blood Information</h3>
            <div class="info-row">
                <div class="info-label">Blood Group:</div>
                <div class="info-value"><strong style="color: #dc2626; font-size: 20px;">🩸 ${donor.bloodGroup || 'N/A'}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Last Donated:</div>
                <div class="info-value">${donor.lastDonatedAt ? formatDateTime(donor.lastDonatedAt) + ' (' + getTimeAgo(donor.lastDonatedAt) + ')' : 'Never'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Emergency Available:</div>
                <div class="info-value"><strong>${String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes' ? '✓ YES' : '✗ NO'}</strong></div>
            </div>
        </div>

        <div class="info-card">
            <h3>🏥 Medical History</h3>
            <div class="info-row" style="grid-template-columns: 1fr;">
                <div>
                    <div class="info-label" style="margin-bottom: 8px;">Medical Conditions:</div>
                    <div class="info-value" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        ${escapeHtml(donor.medicalHistory || 'No medical history provided')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createDonationsTab(donor, donations) {
    let html = `
        <div class="info-card">
            <h3>🩸 Donation Summary</h3>
            <div class="info-row">
                <div class="info-label">Total Donations:</div>
                <div class="info-value"><strong>${donations.length}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Last Donation:</div>
                <div class="info-value">${donor.lastDonatedAt ? formatDateTime(donor.lastDonatedAt) : 'Never'}</div>
            </div>
        </div>
    `;

    if (donations.length > 0) {
        donations.forEach((donation, index) => {
            // Safely encode donation data for the edit button
            const donationJson = encodeURIComponent(JSON.stringify(donation));
            const superuserLogActions = isSuperuser() ? `
                <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid #f3f4f6;">
                    <button onclick="editDonationLog('${donation.id}', decodeURIComponent('${donationJson}'))"
                        style="flex:1; padding:7px 12px; border-radius:7px; border:1.5px solid #667eea;
                               background:#fff; color:#667eea; font-size:12px; font-weight:600;
                               cursor:pointer; transition:all 0.2s;"
                        onmouseover="this.style.background='#667eea';this.style.color='#fff'"
                        onmouseout="this.style.background='#fff';this.style.color='#667eea'">
                        ✏️ Edit Log
                    </button>
                    <button onclick="deleteDonationLog('${donation.id}', '${escapeHtml(donation.patientName || 'this log')}', '${escapeHtml(donation.donationType || 'Whole Blood')}')"
                        style="flex:1; padding:7px 12px; border-radius:7px; border:1.5px solid #ef4444;
                               background:#fff; color:#ef4444; font-size:12px; font-weight:600;
                               cursor:pointer; transition:all 0.2s;"
                        onmouseover="this.style.background='#ef4444';this.style.color='#fff'"
                        onmouseout="this.style.background='#fff';this.style.color='#ef4444'">
                        🗑️ Delete
                    </button>
                </div>
            ` : '';

            html += `
                <div class="info-card" id="donation-card-${donation.id}">
                    <h3>🩸 Donation #${index + 1}</h3>
                    <div class="info-row">
                        <div class="info-label">Patient Name:</div>
                        <div class="info-value"><strong>${escapeHtml(donation.patientName || 'Not specified')}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Blood Group:</div>
                        <div class="info-value"><strong style="color: #dc2626;">${donation.bloodGroup || 'N/A'}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Donation Type:</div>
                        <div class="info-value">${escapeHtml(donation.donationType || 'Whole Blood')}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Units Donated:</div>
                        <div class="info-value"><strong>${donation.unitsDonated || donation.unitsGiven || 0} Unit(s)</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Hospital:</div>
                        <div class="info-value">${escapeHtml(donation.hospital || '—')}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Donation Date:</div>
                        <div class="info-value">${formatDateTime(donation.timestamp || donation.donatedAt)}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Recorded By:</div>
                        <div class="info-value">👤 ${escapeHtml(donation.recordedByName || donation.loggedBy || donation.createdBy || 'Unknown')}</div>
                    </div>
                    ${donation.notes ? `
                    <div class="info-row">
                        <div class="info-label">Notes:</div>
                        <div class="info-value" style="font-style:italic; color:#6b7280;">${escapeHtml(donation.notes)}</div>
                    </div>` : ''}
                    <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                        ${donation.source === 'admin_manual' ? `<span style="font-size:11px; background:#f0fdf4; color:#059669; padding:2px 8px; border-radius:20px; font-weight:600;">✍️ Manually Logged</span>` : ''}
                        ${donation.requestId ? `<span style="font-size:11px; background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:20px; font-weight:600;">🔗 Linked to Request</span>` : ''}
                    </div>
                    ${superuserLogActions}
                </div>
            `;
        });

    } else {
        html += `
            <div class="info-card" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                <h3 style="color: #6b7280;">No Donations Yet</h3>
                <p style="color: #9ca3af; margin-top: 10px;">This donor hasn't made any donations yet.</p>
            </div>
        `;
    }

    return html;
}

// ============================================================================
// FETCH DONATION HISTORY
// ============================================================================
async function fetchDonationHistory(donor) {
    try {
        if (!donor.id) return [];

        const donationsRef = collection(db, 'donation_logs');
        const q = query(donationsRef, where('donorId', '==', donor.id));
        const snapshot = await getDocs(q);

        const donations = [];
        snapshot.forEach((doc) => {
            donations.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by timestamp (newest first)
        donations.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
        });

        return donations;
    } catch (error) {
        console.error('Error fetching donation history:', error);
        return [];
    }
}

// ============================================================================
// MODAL CONTROLS
// ============================================================================
window.closeModal = function () {
    document.getElementById('viewModal').classList.remove('active');
};

window.switchTab = function (tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
};

// Close modal on outside click
document.getElementById('viewModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeModal();
    }
});

// ============================================================================
// PAGINATION
// ============================================================================
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    const donorsToDisplay = filteredDonors.length > 0 || searchQuery || hasActiveFilters()
        ? filteredDonors
        : allDonors;
    const totalPages = Math.ceil(donorsToDisplay.length / donorsPerPage);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="pagination-prev" 
                ${currentPage === 1 ? 'disabled' : ''}
                aria-label="Previous page">
            «
        </button>
    `;

    // Smart pagination with ellipsis
    const showPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
    }

    // Show first page and ellipsis if needed
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-page" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
        }
    }

    // Show page numbers
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-page ${i === currentPage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    // Show last page and ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<button class="pagination-ellipsis" disabled>...</button>`;
        }
        const lastPageActive = currentPage === totalPages ? 'active' : '';
        paginationHTML += `<button class="pagination-page ${lastPageActive}" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationHTML += `
        <button class="pagination-next" 
                ${currentPage === totalPages ? 'disabled' : ''}
                aria-label="Next page">
            »
        </button>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // Add event listeners
    const prevBtn = paginationContainer.querySelector('.pagination-prev');
    const nextBtn = paginationContainer.querySelector('.pagination-next');
    const pageBtns = paginationContainer.querySelectorAll('.pagination-page');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    pageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page);
            renderTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ============================================================================
// SEARCH AND FILTER COMBINED INITIALIZATION
// ============================================================================
function initializeSearchAndFilters() {
    const container = document.getElementById('searchFiltersContainer');
    if (container) {
        container.style.display = 'block';
    }

    initializeSearch();
    initializeFilters();
}

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput || !clearSearchBtn) {
        console.error('Search elements not found');
        return;
    }

    // Debounce timer
    let debounceTimer = null;

    // Search input event
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();

        // Show/hide clear button
        clearSearchBtn.style.display = value ? 'flex' : 'none';

        // Debounce search
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            performSearch(value);
        }, 300);
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        performSearch('');
        searchInput.focus();
    });

    // Enter key to search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(debounceTimer);
            performSearch(searchInput.value.trim());
        }
    });
}

function performSearch(query) {
    searchQuery = query.toLowerCase();
    const searchResults = document.getElementById('searchResults');

    if (!searchQuery) {
        searchResults.textContent = '';
        searchResults.className = 'search-results-info';
        searchResults.style.display = 'none';
    } else {
        searchResults.style.display = 'block';
    }

    currentPage = 1;
    renderTable();

    // Update search results display
    if (searchQuery && filteredDonors.length > 0) {
        searchResults.textContent = `Found ${filteredDonors.length} donor${filteredDonors.length === 1 ? '' : 's'}`;
        searchResults.className = 'search-results-info has-results';
    } else if (searchQuery) {
        searchResults.textContent = `No results found`;
        searchResults.className = 'search-results-info no-results';
    }
}

// ============================================================================
// FILTER FUNCTIONALITY
// ============================================================================
function initializeFilters() {
    const bloodGroupFilter = document.getElementById('filterBloodGroup');
    const cityFilter = document.getElementById('filterCity');
    const emergencyFilter = document.getElementById('filterEmergency');
    const clearFiltersBtn = document.getElementById('clearFilters');

    if (!bloodGroupFilter || !cityFilter || !emergencyFilter) {
        console.error('Filter elements not found');
        return;
    }

    // Blood group filter
    bloodGroupFilter.addEventListener('change', (e) => {
        activeFilters.bloodGroup = e.target.value;
        updateClearFiltersButton();
        currentPage = 1;
        renderTable();
    });

    // City filter
    cityFilter.addEventListener('change', (e) => {
        activeFilters.city = e.target.value;
        updateClearFiltersButton();
        currentPage = 1;
        renderTable();
    });

    // Emergency filter
    emergencyFilter.addEventListener('change', (e) => {
        activeFilters.emergency = e.target.value;
        updateClearFiltersButton();
        currentPage = 1;
        renderTable();
    });

    // Clear filters button
    clearFiltersBtn.addEventListener('click', () => {
        activeFilters = {
            bloodGroup: '',
            city: '',
            emergency: ''
        };
        bloodGroupFilter.value = '';
        cityFilter.value = '';
        emergencyFilter.value = '';
        updateClearFiltersButton();
        currentPage = 1;
        renderTable();
    });
}

function updateClearFiltersButton() {
    const clearFiltersBtn = document.getElementById('clearFilters');
    const hasFilters = hasActiveFilters();
    clearFiltersBtn.style.display = hasFilters ? 'block' : 'none';
}

function hasActiveFilters() {
    return activeFilters.bloodGroup || activeFilters.city || activeFilters.emergency;
}

function updateFilterResults() {
    const filterResults = document.getElementById('filterResults');

    if (hasActiveFilters() || searchQuery) {
        const filterTexts = [];
        if (activeFilters.bloodGroup) filterTexts.push(`Blood: ${activeFilters.bloodGroup}`);
        if (activeFilters.city) filterTexts.push(`City: ${activeFilters.city}`);
        if (activeFilters.emergency) filterTexts.push(`Emergency: ${activeFilters.emergency === 'yes' ? 'Yes' : 'No'}`);

        const filterText = filterTexts.length > 0 ? ` (${filterTexts.join(', ')})` : '';
        filterResults.textContent = `Showing ${filteredDonors.length} of ${allDonors.length} donors${filterText}`;
        filterResults.style.display = 'block';
    } else {
        filterResults.style.display = 'none';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatDateTime(date) {
    if (!date) return 'N/A';

    let d;
    if (date && typeof date === 'object' && date.seconds) {
        d = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
        d = date;
    } else {
        d = new Date(date);
    }

    if (isNaN(d.getTime())) return 'Invalid Date';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    return `${day} ${month} ${year}`;
}

function getTimeAgo(date) {
    if (!date) return '';

    let d;
    if (date && typeof date === 'object' && date.seconds) {
        d = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
        d = date;
    } else {
        d = new Date(date);
    }

    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${diffMonths}mo ago`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// SHOW TOAST NOTIFICATION
// ============================================================================
function showDonorToast(message, type = 'success') {
    const existing = document.getElementById('donorToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'donorToast';
    const bg = type === 'success' ? '#10b981' : '#dc2626';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${bg};
        color: white;
        padding: 14px 22px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 99999;
        font-weight: 600;
        font-size: 15px;
        animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ============================================================================
// SUPERUSER: EDIT DONOR — new modal (edm-overlay)
// ============================================================================

// Helper: format a Firestore timestamp or Date to YYYY-MM-DD string
function toDateInputValue(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Switch between Edit Profile / Log Donation tabs
window.switchEdmTab = function (tab) {
    // Tab buttons
    document.getElementById('edm-tab-profile-btn').classList.toggle('active', tab === 'profile');
    document.getElementById('edm-tab-donation-btn').classList.toggle('active', tab === 'donation');
    // Tab panels
    document.getElementById('edm-panel-profile').classList.toggle('active', tab === 'profile');
    document.getElementById('edm-panel-donation').classList.toggle('active', tab === 'donation');
    // Footer save button — hide on Log Donation tab, show on Profile tab
    const saveBtn = document.getElementById('editDonorSaveBtn');
    if (saveBtn) saveBtn.style.display = tab === 'profile' ? '' : 'none';

    // Set today's date on Log Donation if empty
    if (tab === 'donation') {
        const dateField = document.getElementById('logDonationDate');
        if (dateField && !dateField.value) {
            dateField.value = toDateInputValue(new Date());
        }
    }
};

window.editDonor = function (donorId) {
    if (!isSuperuser()) {
        alert('Access denied. Only superusers can edit donors.');
        return;
    }

    const donor = allDonors.find(d => d.id === donorId);
    if (!donor) { alert('Donor not found.'); return; }

    // ── Populate header ──────────────────────────────────────
    const name = donor.fullName || 'Unknown Donor';
    const blood = donor.bloodGroup || '—';
    const city = donor.city || '—';
    const phone = donor.contactNumber || '—';
    const emrg = String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes' ? 'Yes ✅' : 'No ❌';

    // Avatar initials (up to 2 chars)
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('edm-avatar').textContent = initials;
    document.getElementById('edm-header-name').textContent = name;
    document.getElementById('edm-tag-blood').textContent = `🩸 ${blood}`;
    document.getElementById('edm-tag-city').textContent = `📍 ${city}`;
    document.getElementById('edm-tag-phone').textContent = `📞 ${phone}`;
    document.getElementById('edm-tag-emergency').textContent = `🚨 Emergency: ${emrg}`;

    // ── Populate Edit Profile form fields ────────────────────
    document.getElementById('editDonorId').value = donor.id;
    document.getElementById('editFullName').value = donor.fullName || '';
    document.getElementById('editBloodGroup').value = donor.bloodGroup || '';
    document.getElementById('editContactNumber').value = donor.contactNumber || '';
    document.getElementById('editEmail').value = donor.email || '';
    document.getElementById('editAge').value = donor.age || '';
    document.getElementById('editGender').value = donor.gender || '';
    document.getElementById('editWeight').value = donor.weight || '';
    document.getElementById('editCity').value = donor.city || '';
    document.getElementById('editArea').value = donor.area || '';
    document.getElementById('editEmergencyAvailable').value =
        String(donor.isEmergencyAvailable || '').toLowerCase() === 'yes' ? 'yes' : 'no';
    document.getElementById('editMedicalHistory').value = donor.medicalHistory || '';
    document.getElementById('editLastDonatedAt').value = toDateInputValue(donor.lastDonatedAt);

    // ── Reset UI state ───────────────────────────────────────
    const statusEl = document.getElementById('edm-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = ''; }
    const saveBtn = document.getElementById('editDonorSaveBtn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Changes'; saveBtn.style.display = ''; }

    // Reset Log Donation form
    resetLogDonationForm();

    // Start on Profile tab
    switchEdmTab('profile');

    // ── Show the new overlay ─────────────────────────────────
    document.getElementById('edm-overlay').classList.add('active');
};

window.closeEditDonorModal = function () {
    document.getElementById('edm-overlay').classList.remove('active');
};

window.saveEditDonor = async function () {
    if (!isSuperuser()) return;

    const donorId = document.getElementById('editDonorId').value;
    const statusEl = document.getElementById('edm-status');
    const saveBtn = document.getElementById('editDonorSaveBtn');

    // Validate
    const fullName = document.getElementById('editFullName').value.trim();
    if (!fullName) {
        statusEl.textContent = '⚠️ Full name is required.';
        statusEl.className = 'err';
        return;
    }

    // Build payload
    const updateData = {
        fullName,
        bloodGroup: document.getElementById('editBloodGroup').value.trim(),
        contactNumber: document.getElementById('editContactNumber').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        age: parseInt(document.getElementById('editAge').value) || 0,
        gender: document.getElementById('editGender').value,
        weight: document.getElementById('editWeight').value.trim(),
        city: document.getElementById('editCity').value.trim(),
        area: document.getElementById('editArea').value.trim(),
        isEmergencyAvailable: document.getElementById('editEmergencyAvailable').value,
        medicalHistory: document.getElementById('editMedicalHistory').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.displayName || 'Superuser',
        updatedByUid: currentUser?.uid || ''
    };

    const lastDonatedInput = document.getElementById('editLastDonatedAt').value;
    if (lastDonatedInput) {
        updateData.lastDonatedAt = new Date(lastDonatedInput + 'T00:00:00');
    }

    // Saving state
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
    statusEl.textContent = '';
    statusEl.className = '';

    try {
        await updateDoc(doc(db, 'donors', donorId), updateData);

        // Patch local cache
        const idx = allDonors.findIndex(d => d.id === donorId);
        if (idx !== -1) {
            allDonors[idx] = {
                ...allDonors[idx],
                ...updateData,
                lastDonatedAt: lastDonatedInput
                    ? { seconds: new Date(lastDonatedInput + 'T00:00:00').getTime() / 1000 }
                    : allDonors[idx].lastDonatedAt
            };
        }

        renderTable();
        updateStatistics();
        window.closeEditDonorModal();
        showDonorToast('✅ Donor updated successfully!');

    } catch (err) {
        console.error('Error updating donor:', err);
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.className = 'err';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
    }
};

// ============================================================================
// SUPERUSER: LOG DONATION
// ============================================================================

// Patient request search — debounced live search
let _patientSearchTimer = null;
window.searchPatientRequests = function (searchText) {
    // Clear linked request when user types manually
    document.getElementById('logRequestId').value = '';
    document.getElementById('logRequestBloodGroup').value = '';
    document.getElementById('logRequestBadge').style.display = 'none';

    clearTimeout(_patientSearchTimer);
    const dropdown = document.getElementById('logPatientDropdown');

    if (!searchText.trim() || searchText.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    _patientSearchTimer = setTimeout(async () => {
        try {
            // No server-side name filter — fetch all and filter client-side
            // so search is fully case-insensitive (lower / UPPER / CamelCase)
            const q = query(collection(db, 'emergency_requests'), orderBy('patientName'));
            const snap = await getDocs(q);
            const term = searchText.trim().toLowerCase();
            const results = [];
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                if ((data.patientName || '').toLowerCase().includes(term)) {
                    results.push(data);
                }
            });


            if (results.length === 0) {
                dropdown.innerHTML = `<div style="padding:12px 16px; color:#9ca3af; font-size:13px;">No matching requests found</div>`;
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = results.map(r => `
                <div onclick="selectPatientRequest('${r.id}', '${escapeHtml(r.patientName || '')}', '${escapeHtml(r.bloodType || '')}', '${escapeHtml(r.city || '')}')"
                    style="padding:10px 16px; cursor:pointer; border-bottom:1px solid #f3f4f6;
                           font-size:13px; transition:background 0.15s;"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background=''">
                    <div style="font-weight:600; color:#1f2937;">${escapeHtml(r.patientName || 'Unknown')}</div>
                    <div style="color:#6b7280; font-size:11px; margin-top:2px;">
                        🩸 ${r.bloodType || '—'} &nbsp;•&nbsp; 📍 ${r.city || '—'} &nbsp;•&nbsp;
                        <span style="color:${r.status === 'fulfilled' ? '#059669' : r.status === 'open' ? '#dc2626' : '#6b7280'};">
                            ${r.status || 'unknown'}
                        </span>
                    </div>
                </div>
            `).join('');
            dropdown.style.display = 'block';
        } catch (err) {
            console.warn('Patient search error:', err);
            dropdown.style.display = 'none';
        }
    }, 300);
};

window.selectPatientRequest = function (requestId, patientName, bloodGroup, city) {
    document.getElementById('logPatientSearch').value = patientName;
    document.getElementById('logRequestId').value = requestId;
    document.getElementById('logRequestBloodGroup').value = bloodGroup;
    document.getElementById('logPatientDropdown').style.display = 'none';
    // Show linked badge
    document.getElementById('logRequestBadgeText').textContent = `Linked to request: ${patientName} (${bloodGroup || '—'}, ${city || '—'})`;
    document.getElementById('logRequestBadge').style.display = 'inline-flex';
};

// Close dropdown when clicking outside
document.addEventListener('click', e => {
    const dd = document.getElementById('logPatientDropdown');
    if (dd && !dd.contains(e.target) && e.target.id !== 'logPatientSearch') {
        dd.style.display = 'none';
    }
});

window.resetLogDonationForm = function () {
    document.getElementById('logDonationDate').value = '';
    document.getElementById('logDonationType').value = '';
    document.getElementById('logDonationUnits').value = '1';
    document.getElementById('logDonationHospital').value = '';
    document.getElementById('logDonationNotes').value = '';
    // Patient search
    const ps = document.getElementById('logPatientSearch');
    if (ps) ps.value = '';
    const rid = document.getElementById('logRequestId');
    if (rid) rid.value = '';
    const rbg = document.getElementById('logRequestBloodGroup');
    if (rbg) rbg.value = '';
    const badge = document.getElementById('logRequestBadge');
    if (badge) badge.style.display = 'none';
    const dd = document.getElementById('logPatientDropdown');
    if (dd) { dd.style.display = 'none'; dd.innerHTML = ''; }
    // Status
    const s = document.getElementById('edm-log-status');
    if (s) { s.textContent = ''; s.style.color = ''; }
    document.getElementById('edm-log-success').style.display = 'none';
    document.getElementById('edm-log-form').style.display = 'block';
};

window.saveLogDonation = async function () {
    if (!isSuperuser()) return;

    const donorId = document.getElementById('editDonorId').value;
    const donor = allDonors.find(d => d.id === donorId);
    const statusEl = document.getElementById('edm-log-status');
    const logBtn = document.getElementById('edm-log-btn');

    const donationDate = document.getElementById('logDonationDate').value;
    const donationType = document.getElementById('logDonationType').value;
    const patientName = document.getElementById('logPatientSearch').value.trim();
    const linkedReqId = document.getElementById('logRequestId').value.trim();
    const linkedBlood = document.getElementById('logRequestBloodGroup').value.trim();

    if (!donationDate) {
        statusEl.textContent = '⚠️ Please select a donation date.';
        statusEl.style.color = '#dc2626';
        return;
    }
    if (!donationType) {
        statusEl.textContent = '⚠️ Please select a donation type.';
        statusEl.style.color = '#dc2626';
        return;
    }

    logBtn.disabled = true;
    logBtn.textContent = '⏳ Logging...';
    statusEl.textContent = '';

    const donatedAtDate = new Date(donationDate + 'T00:00:00');
    const units = parseInt(document.getElementById('logDonationUnits').value) || 1;

    // Use the existing schema field names so the donor detail view reads them correctly
    const logEntry = {
        donorId: donorId,
        donorName: donor?.fullName || '',
        donorContact: donor?.contactNumber || '',
        bloodGroup: donor?.bloodGroup || '',
        // Patient / request link
        patientName: patientName || '',
        requestId: linkedReqId || '',
        patientBloodGroup: linkedBlood || donor?.bloodGroup || '',
        // Donation details — match schema used by firebase-data-service.js
        unitsDonated: units,
        donationType: donationType,
        donorType: 'donor',
        hospital: document.getElementById('logDonationHospital').value.trim(),
        notes: document.getElementById('logDonationNotes').value.trim(),
        // Timestamps — match schema (timestamp = primary date field read by display)
        timestamp: donatedAtDate,
        donatedAt: donatedAtDate,
        createdAt: serverTimestamp(),
        // Recorded by — match schema
        recordedByName: currentUser?.displayName || 'Superuser',
        recordedByUid: currentUser?.uid || '',
        createdBy: currentUser?.displayName || 'Superuser',
        createdById: currentUser?.uid || '',
        source: 'admin_manual'
    };

    try {
        // 1. Write donation_log entry
        await addDoc(collection(db, 'donation_logs'), logEntry);

        // 2. Update donor's lastDonatedAt
        await updateDoc(doc(db, 'donors', donorId), {
            lastDonatedAt: donatedAtDate,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser?.displayName || 'Superuser',
            updatedByUid: currentUser?.uid || ''
        });

        // 3. Patch local cache
        const idx = allDonors.findIndex(d => d.id === donorId);
        if (idx !== -1) {
            allDonors[idx].lastDonatedAt = { seconds: donatedAtDate.getTime() / 1000 };
        }

        renderTable();
        updateStatistics();

        // 4. Show success state
        document.getElementById('edm-log-form').style.display = 'none';
        document.getElementById('edm-log-success').style.display = 'block';
        showDonorToast('🩸 Donation logged successfully!');

    } catch (err) {
        console.error('Error logging donation:', err);
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.style.color = '#dc2626';
    } finally {
        logBtn.disabled = false;
        logBtn.textContent = '🩸 Log Donation';
    }
};

// Close edit modal on outside click + inject modals
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('edm-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window.closeEditDonorModal();
        });
    }

    // ── Inject: Delete Donor Confirmation Modal ──────────────────────────────
    const deleteConfirmHtml = `
        <div id="deleteConfirmModal" style="
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.55);
            z-index: 99998;
            align-items: center;
            justify-content: center;
            padding: 20px;
        ">
            <div style="
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 440px;
                width: 100%;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25);
                text-align: center;
            ">
                <div style="font-size: 56px; margin-bottom: 16px;">🗑️</div>
                <h3 style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Delete Donor?</h3>
                <p id="deleteConfirmMsg" style="color: #6b7280; font-size: 15px; margin-bottom: 24px; line-height: 1.5;"></p>
                <div id="deleteConfirmError" style="
                    display: none;
                    color: #dc2626;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 16px;
                    font-size: 14px;
                "></div>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="deleteCancelBtn" onclick="closeDeleteConfirm()" style="
                        padding: 11px 28px;
                        border-radius: 8px;
                        border: 1.5px solid #d1d5db;
                        background: #f3f4f6;
                        color: #374151;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">Cancel</button>
                    <button id="deleteConfirmBtn" onclick="confirmDeleteDonor()" style="
                        padding: 11px 28px;
                        border-radius: 8px;
                        border: none;
                        background: #dc2626;
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(220,38,38,0.35);
                        transition: all 0.2s;
                    ">Yes, Delete</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', deleteConfirmHtml);
    const deleteModal = document.getElementById('deleteConfirmModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) window.closeDeleteConfirm();
        });
    }

    // ── Inject: Edit Donation Log Modal ──────────────────────────────────────
    const editLogModalHtml = `
        <div id="editLogModal" style="
            display:none; position:fixed; inset:0;
            background:rgba(0,0,0,0.6); z-index:99999;
            align-items:center; justify-content:center;
            padding:16px; backdrop-filter:blur(3px);
        ">
            <div style="
                background:#fff; border-radius:16px; width:100%; max-width:580px;
                max-height:90vh; overflow-y:auto;
                box-shadow:0 24px 60px rgba(0,0,0,0.3);
                display:flex; flex-direction:column;
            ">
                <!-- Header -->
                <div style="
                    background:linear-gradient(135deg,#667eea,#764ba2);
                    border-radius:16px 16px 0 0; padding:20px 24px;
                    display:flex; align-items:center; justify-content:space-between;
                ">
                    <div>
                        <div style="font-size:18px; font-weight:700; color:#fff;">✏️ Edit Donation Log</div>
                        <div id="editLogSubtitle" style="font-size:12px; color:rgba(255,255,255,0.75); margin-top:2px;"></div>
                    </div>
                    <button onclick="closeEditLogModal()" style="
                        background:rgba(255,255,255,0.15); border:none; color:#fff;
                        width:30px; height:30px; border-radius:50%; font-size:18px;
                        cursor:pointer; display:flex; align-items:center; justify-content:center;
                    ">✕</button>
                </div>

                <!-- Body -->
                <div style="padding:24px; display:flex; flex-direction:column; gap:16px;">
                    <input type="hidden" id="editLogId">

                    <!-- Patient Name -->
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:12px; font-weight:600; color:#6b7280;">Patient / Recipient Name</label>
                        <input id="editLogPatientName" type="text" placeholder="Enter patient name (optional)" style="
                            width:100%; box-sizing:border-box; padding:10px 12px;
                            border:1.5px solid #e5e7eb; border-radius:8px;
                            font-size:14px; color:#1f2937; font-family:inherit;
                            outline:none; transition:border-color 0.2s;
                        " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
                    </div>

                    <!-- Date + Type (2-col) -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:12px; font-weight:600; color:#6b7280;">Donation Date <span style="color:#dc2626;">*</span></label>
                            <input id="editLogDate" type="date" style="
                                width:100%; box-sizing:border-box; padding:10px 12px;
                                border:1.5px solid #e5e7eb; border-radius:8px;
                                font-size:14px; color:#1f2937; font-family:inherit;
                                outline:none; transition:border-color 0.2s;
                            " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:12px; font-weight:600; color:#6b7280;">Donation Type <span style="color:#dc2626;">*</span></label>
                            <select id="editLogType" style="
                                width:100%; box-sizing:border-box; padding:10px 12px;
                                border:1.5px solid #e5e7eb; border-radius:8px;
                                font-size:14px; color:#1f2937; font-family:inherit;
                                outline:none; transition:border-color 0.2s; background:#fff;
                            " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
                                <option value="Whole Blood">🩸 Whole Blood</option>
                                <option value="SDP">🧪 SDP (Single Donor Platelet)</option>
                                <option value="Plasma">💉 Plasma</option>
                                <option value="Packed Cells">🔴 Packed Cells</option>
                                <option value="Double Red Cells">⭕ Double Red Cells</option>
                            </select>
                        </div>
                    </div>

                    <!-- Units + Hospital (2-col) -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:12px; font-weight:600; color:#6b7280;">Units Donated</label>
                            <input id="editLogUnits" type="number" min="1" max="5" placeholder="e.g. 1" style="
                                width:100%; box-sizing:border-box; padding:10px 12px;
                                border:1.5px solid #e5e7eb; border-radius:8px;
                                font-size:14px; color:#1f2937; font-family:inherit;
                                outline:none; transition:border-color 0.2s;
                            " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:12px; font-weight:600; color:#6b7280;">Hospital / Location</label>
                            <input id="editLogHospital" type="text" placeholder="e.g. Civil Hospital" style="
                                width:100%; box-sizing:border-box; padding:10px 12px;
                                border:1.5px solid #e5e7eb; border-radius:8px;
                                font-size:14px; color:#1f2937; font-family:inherit;
                                outline:none; transition:border-color 0.2s;
                            " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                    </div>

                    <!-- Notes -->
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:12px; font-weight:600; color:#6b7280;">Notes (optional)</label>
                        <textarea id="editLogNotes" rows="3" placeholder="Any notes about this donation..." style="
                            width:100%; box-sizing:border-box; padding:10px 12px;
                            border:1.5px solid #e5e7eb; border-radius:8px;
                            font-size:14px; color:#1f2937; font-family:inherit;
                            outline:none; resize:vertical; transition:border-color 0.2s;
                        " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
                    </div>

                    <!-- Status -->
                    <div id="editLogStatus" style="font-size:13px; font-weight:500; min-height:18px;"></div>
                </div>

                <!-- Footer -->
                <div style="
                    display:flex; justify-content:flex-end; gap:10px;
                    padding:16px 24px; border-top:1px solid #f3f4f6;
                    background:#fafafa; border-radius:0 0 16px 16px;
                ">
                    <button onclick="closeEditLogModal()" style="
                        padding:10px 22px; border-radius:8px; border:1.5px solid #e5e7eb;
                        background:#f3f4f6; color:#374151; font-size:14px; font-weight:600; cursor:pointer;
                    ">Cancel</button>
                    <button id="editLogSaveBtn" onclick="saveEditDonationLog()" style="
                        padding:10px 22px; border-radius:8px; border:none;
                        background:linear-gradient(135deg,#667eea,#764ba2);
                        color:#fff; font-size:14px; font-weight:600; cursor:pointer;
                        box-shadow:0 4px 14px rgba(102,126,234,0.4);
                        transition:all 0.2s;
                    ">💾 Save Changes</button>
                </div>
            </div>
        </div>

        <!-- Delete Donation Log Confirm -->
        <div id="deleteLogModal" style="
            display:none; position:fixed; inset:0;
            background:rgba(0,0,0,0.6); z-index:99999;
            align-items:center; justify-content:center; padding:16px;
        ">
            <div style="
                background:#fff; border-radius:16px; padding:32px;
                max-width:420px; width:100%; text-align:center;
                box-shadow:0 24px 60px rgba(0,0,0,0.3);
            ">
                <div style="font-size:52px; margin-bottom:12px;">🗑️</div>
                <h3 style="font-size:19px; font-weight:700; color:#1f2937; margin-bottom:8px;">Delete Donation Log?</h3>
                <p id="deleteLogMsg" style="color:#6b7280; font-size:14px; line-height:1.5; margin-bottom:20px;"></p>
                <div id="deleteLogErr" style="display:none; color:#dc2626; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px;"></div>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="closeDeleteLogModal()" style="
                        padding:10px 24px; border-radius:8px; border:1.5px solid #d1d5db;
                        background:#f3f4f6; color:#374151; font-size:14px; font-weight:600; cursor:pointer;
                    ">Cancel</button>
                    <button id="deleteLogConfirmBtn" onclick="confirmDeleteDonationLog()" style="
                        padding:10px 24px; border-radius:8px; border:none;
                        background:#dc2626; color:#fff; font-size:14px; font-weight:600;
                        cursor:pointer; box-shadow:0 4px 12px rgba(220,38,38,0.35);
                    ">Yes, Delete</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', editLogModalHtml);

    // Close edit log modal on backdrop click
    document.getElementById('editLogModal').addEventListener('click', e => {
        if (e.target.id === 'editLogModal') closeEditLogModal();
    });
    document.getElementById('deleteLogModal').addEventListener('click', e => {
        if (e.target.id === 'deleteLogModal') closeDeleteLogModal();
    });
});

// ============================================================================
// SUPERUSER: DELETE DONOR
// ============================================================================
let _pendingDeleteId = null;

window.deleteDonor = function (donorId) {
    if (!isSuperuser()) {
        alert('Access denied. Only superusers can delete donors.');
        return;
    }

    const donor = allDonors.find(d => d.id === donorId);
    if (!donor) {
        alert('Donor not found.');
        return;
    }

    _pendingDeleteId = donorId;

    // Set the confirm message
    const name = donor.fullName || 'Unknown';
    const blood = donor.bloodGroup ? ` (${donor.bloodGroup})` : '';
    document.getElementById('deleteConfirmMsg').innerHTML =
        `You are about to permanently delete <strong>${escapeHtml(name)}${blood}</strong>.<br>This action <strong>cannot be undone</strong>.`;

    // Reset error/button state
    const errEl = document.getElementById('deleteConfirmError');
    errEl.style.display = 'none';
    errEl.textContent = '';
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Yes, Delete';

    // Show modal
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'flex';
};

window.closeDeleteConfirm = function () {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.style.display = 'none';
    _pendingDeleteId = null;
};

window.confirmDeleteDonor = async function () {
    if (!isSuperuser() || !_pendingDeleteId) return;

    const donorId = _pendingDeleteId;
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const errEl = document.getElementById('deleteConfirmError');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
    errEl.style.display = 'none';

    try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'donors', donorId));

        // Remove from local arrays
        const idx = allDonors.findIndex(d => d.id === donorId);
        if (idx !== -1) allDonors.splice(idx, 1);

        // Also remove from filteredDonors if present
        const fidx = filteredDonors.findIndex(d => d.id === donorId);
        if (fidx !== -1) filteredDonors.splice(fidx, 1);

        // Close modal first
        window.closeDeleteConfirm();

        // Re-render table and statistics
        currentPage = 1;
        renderTable();
        updateStatistics();
        populateCityFilter();

        showDonorToast('🗑️ Donor deleted successfully.');

    } catch (error) {
        console.error('Error deleting donor:', error);
        errEl.textContent = `❌ Failed to delete: ${error.message}`;
        errEl.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
    }
};



// ============================================================================
// SUPERUSER: EDIT / DELETE DONATION LOG
// ============================================================================

// Helper: convert Firestore timestamp-like value → YYYY-MM-DD string for <input type="date">
function _logDateToInputValue(val) {
    if (!val) return '';
    try {
        let d;
        if (val.toDate) d = val.toDate();
        else if (val.seconds) d = new Date(val.seconds * 1000);
        else d = new Date(val);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch { return ''; }
}

window.editDonationLog = function (logId, donationJsonStr) {
    if (!isSuperuser()) return;

    let donation;
    try { donation = JSON.parse(donationJsonStr); }
    catch { donation = {}; }

    document.getElementById('editLogId').value = logId;
    document.getElementById('editLogPatientName').value = donation.patientName || '';
    document.getElementById('editLogDate').value = _logDateToInputValue(donation.timestamp || donation.donatedAt);
    document.getElementById('editLogType').value = donation.donationType || 'Whole Blood';
    document.getElementById('editLogUnits').value = donation.unitsDonated || donation.unitsGiven || 1;
    document.getElementById('editLogHospital').value = donation.hospital || '';
    document.getElementById('editLogNotes').value = donation.notes || '';

    const donorName = donation.donorName || '';
    document.getElementById('editLogSubtitle').textContent =
        donorName ? `Donation by ${donorName}` : 'Edit donation details';

    const status = document.getElementById('editLogStatus');
    status.textContent = '';
    status.style.color = '';

    document.getElementById('editLogModal').style.display = 'flex';
};

window.closeEditLogModal = function () {
    document.getElementById('editLogModal').style.display = 'none';
};

window.saveEditDonationLog = async function () {
    if (!isSuperuser()) return;

    const logId = document.getElementById('editLogId').value;
    const dateVal = document.getElementById('editLogDate').value;
    const typeVal = document.getElementById('editLogType').value;
    const statusEl = document.getElementById('editLogStatus');
    const saveBtn = document.getElementById('editLogSaveBtn');

    if (!logId) { statusEl.textContent = '⚠️ Log ID missing.'; statusEl.style.color = '#dc2626'; return; }
    if (!dateVal) { statusEl.textContent = '⚠️ Please select a date.'; statusEl.style.color = '#dc2626'; return; }
    if (!typeVal) { statusEl.textContent = '⚠️ Please select a donation type.'; statusEl.style.color = '#dc2626'; return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
    statusEl.textContent = '';

    const updatedDate = new Date(dateVal + 'T00:00:00');
    const units = parseInt(document.getElementById('editLogUnits').value) || 1;
    const patientName = document.getElementById('editLogPatientName').value.trim();
    const hospital = document.getElementById('editLogHospital').value.trim();
    const notes = document.getElementById('editLogNotes').value.trim();

    try {
        await updateDoc(doc(db, 'donation_logs', logId), {
            patientName: patientName,
            donationType: typeVal,
            unitsDonated: units,
            unitsGiven: units,
            hospital: hospital,
            notes: notes,
            timestamp: updatedDate,
            donatedAt: updatedDate,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser?.displayName || 'Superuser',
            updatedByUid: currentUser?.uid || ''
        });

        // Update the visible card in the DOM without a full reload
        const card = document.getElementById(`donation-card-${logId}`);
        if (card) {
            const rows = card.querySelectorAll('.info-value');
            // Row order: patientName[0], bloodGroup[1], donationType[2], unitsDonated[3], hospital[4], date[5], recordedBy[6]
            if (rows[0]) rows[0].innerHTML = `<strong>${escapeHtml(patientName || 'Not specified')}</strong>`;
            if (rows[2]) rows[2].textContent = typeVal;
            if (rows[3]) rows[3].innerHTML = `<strong>${units} Unit(s)</strong>`;
            if (rows[4]) rows[4].textContent = hospital || '—';
            if (rows[5]) rows[5].textContent = updatedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        window.closeEditLogModal();
        showDonorToast('✅ Donation log updated!');

    } catch (err) {
        console.error('Error updating donation log:', err);
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.style.color = '#dc2626';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
    }
};

// ── Delete Donation Log ───────────────────────────────────────────────────────
let _pendingDeleteLogId = null;

window.deleteDonationLog = function (logId, patientName, donationType) {
    if (!isSuperuser()) return;

    _pendingDeleteLogId = logId;

    document.getElementById('deleteLogMsg').innerHTML =
        `You are about to delete the <strong>${escapeHtml(donationType)}</strong> donation log` +
        (patientName && patientName !== 'this log'
            ? ` for patient <strong>${escapeHtml(patientName)}</strong>` : '') +
        `.<br>This action <strong>cannot be undone</strong>.`;

    const errEl = document.getElementById('deleteLogErr');
    errEl.style.display = 'none';
    errEl.textContent = '';
    const btn = document.getElementById('deleteLogConfirmBtn');
    btn.disabled = false;
    btn.textContent = 'Yes, Delete';

    document.getElementById('deleteLogModal').style.display = 'flex';
};

window.closeDeleteLogModal = function () {
    document.getElementById('deleteLogModal').style.display = 'none';
    _pendingDeleteLogId = null;
};

window.confirmDeleteDonationLog = async function () {
    if (!isSuperuser() || !_pendingDeleteLogId) return;

    const logId = _pendingDeleteLogId;
    const btn = document.getElementById('deleteLogConfirmBtn');
    const errEl = document.getElementById('deleteLogErr');

    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        await deleteDoc(doc(db, 'donation_logs', logId));

        // Animate and remove card from DOM
        const card = document.getElementById(`donation-card-${logId}`);
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.remove(), 320);
        }

        window.closeDeleteLogModal();
        showDonorToast('🗑️ Donation log deleted.');

    } catch (err) {
        console.error('Error deleting donation log:', err);
        errEl.textContent = `❌ ${err.message}`;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Yes, Delete';
    }
};
