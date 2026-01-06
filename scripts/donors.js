// All Donors Page - Main JavaScript
// Handles authentication, data fetching, table rendering, filtering, and modal display

import { getCurrentUser, isAuthenticated, onAuthChange } from '/scripts/firebase-auth-service.js';
import { db, collection, getDocs, query, where, orderBy } from '/scripts/firebase-config.js';

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
        const q = query(donorsRef, orderBy('registeredAt', 'desc'));
        const snapshot = await getDocs(q);

        allDonors = [];
        snapshot.forEach((doc) => {
            allDonors.push({
                id: doc.id,
                ...doc.data()
            });
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
        if (!d.registeredAt) return false;
        const regDate = d.registeredAt.seconds
            ? new Date(d.registeredAt.seconds * 1000)
            : new Date(d.registeredAt);
        return regDate >= thisMonth;
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

    // 10. Registered Date
    const registered = donor.registeredAt
        ? `<div>${formatDateTime(donor.registeredAt)}<br><small style="color: #6b7280;">${getTimeAgo(donor.registeredAt)}</small></div>`
        : 'N/A';

    // 11. Registered By
    const registeredBy = `👤 ${escapeHtml(donor.createdBy || 'Unknown')}`;

    // 12. Actions
    const actionsHtml = `
        <button class="action-btn" onclick="viewDonor(${index})" title="View Details">
            👁️ View
        </button>
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
window.viewDonor = function (index) {
    const actualIndex = (currentPage - 1) * donorsPerPage + index;
    const donor = filteredDonors[actualIndex];

    if (!donor) {
        console.error('Donor not found:', index);
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
                <div class="info-value">${formatDateTime(donor.registeredAt)}</div>
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
            html += `
                <div class="info-card">
                    <h3>🩸 Donation #${index + 1}</h3>
                    <div class="info-row">
                        <div class="info-label">Patient Name:</div>
                        <div class="info-value"><strong>${escapeHtml(donation.patientName || 'Unknown')}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Blood Group:</div>
                        <div class="info-value"><strong style="color: #dc2626;">${donation.bloodGroup || 'N/A'}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Units Donated:</div>
                        <div class="info-value"><strong>${donation.unitsDonated || 0} Unit(s)</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Donation Date:</div>
                        <div class="info-value">${formatDateTime(donation.timestamp)}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Recorded By:</div>
                        <div class="info-value">👤 ${escapeHtml(donation.recordedByName || 'Unknown')}</div>
                    </div>
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
