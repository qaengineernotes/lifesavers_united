// All Requests Page - Main JavaScript
// Handles authentication, data fetching, table rendering, and modal display

import { getCurrentUser, isAuthenticated, onAuthChange } from '/scripts/firebase-auth-service.js';
import { fetchEmergencyRequestsFromFirebase } from '/scripts/firebase-data-service.js';
import { db, collection, getDocs, query, where, orderBy } from '/scripts/firebase-config.js';

// Global state
let currentUser = null;
let allRequests = [];
let currentPage = 1;
const requestsPerPage = 20;

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
            showAccessDenied('Your account is pending approval. Only approved users can view all requests.');
            return;
        }

        // User is logged in and approved
        await loadAllRequests();
    });
});

// ============================================================================
// SHOW USER PROFILE (Removed - handled by user-profile-ui.js)
// ============================================================================
// Profile display is handled by user-profile-ui.js globally

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
// LOAD ALL REQUESTS
// ============================================================================
async function loadAllRequests() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'none';
        const response = await fetchEmergencyRequestsFromFirebase();

        if (response.success && response.requests) {
            allRequests = response.requests;

            // Sort by creation date (newest first)
            allRequests.sort((a, b) => {
                const dateA = a.inquiryDate instanceof Date ? a.inquiryDate : new Date(a.inquiryDate);
                const dateB = b.inquiryDate instanceof Date ? b.inquiryDate : new Date(b.inquiryDate);
                return dateB - dateA;
            });

            // Update statistics
            updateStatistics(response.statistics);

            // Render first page
            currentPage = 1;
            renderTable();

            // Show table
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('tableContainer').style.display = 'block';
        } else {
            throw new Error('Failed to load requests');
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('loadingState').innerHTML = `
            <div style="color: #dc2626;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Error Loading Requests</p>
                <p style="color: #6b7280;">${error.message}</p>
                <button onclick="location.reload()" class="action-btn" style="margin-top: 20px;">Retry</button>
            </div>
        `;
    }
}

// ============================================================================
// UPDATE STATISTICS
// ============================================================================
function updateStatistics(stats) {
    if (!stats) return;

    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statOpen').textContent = (stats.open || 0) + (stats.reopened || 0);
    document.getElementById('statVerified').textContent = stats.verified || 0;
    document.getElementById('statClosed').textContent = stats.closed || 0;
    document.getElementById('statFulfilled').textContent = stats.fulfilled || 0;
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable() {
    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = '';

    // Calculate pagination
    const startIndex = (currentPage - 1) * requestsPerPage;
    const endIndex = startIndex + requestsPerPage;
    const pageRequests = allRequests.slice(startIndex, endIndex);

    if (pageRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: #6b7280;">
                    No requests found
                </td>
            </tr>
        `;
        return;
    }

    // Render each request
    pageRequests.forEach((request, index) => {
        const row = createTableRow(request, startIndex + index);
        tbody.appendChild(row);
    });

    // Update pagination
    updatePagination();
}

// ============================================================================
// CREATE TABLE ROW
// ============================================================================
function createTableRow(request, index) {
    const tr = document.createElement('tr');
    if (request.status === 'Closed') {
        tr.classList.add('closed-request');
    }

    // 1. Status Badge
    const statusClass = request.status.toLowerCase().replace(' ', '-');
    const statusBadge = `<span class="status-badge ${statusClass}">${request.status.toUpperCase()}</span>`;

    // 2. Request Date
    const requestDate = formatDateTime(request.inquiryDate);
    const timeAgo = getTimeAgo(request.inquiryDate);

    // 3. Patient Name
    const patientName = escapeHtml(request.patientName || 'Unknown');

    // 4. Blood Group
    const bloodGroup = `<strong style="color: #dc2626;">🩸 ${request.bloodType}</strong>`;

    // 5. Units (with progress bar)
    const unitsRequired = parseInt(request.unitsRequired) || 0;
    const unitsFulfilled = parseInt(request.unitsFulfilled) || 0;
    const percentage = unitsRequired > 0 ? Math.round((unitsFulfilled / unitsRequired) * 100) : 0;
    let progressClass = 'zero';
    if (percentage === 100) progressClass = '';
    else if (percentage > 0) progressClass = 'partial';

    const unitsHtml = `
        <div>
            <strong>${unitsFulfilled}/${unitsRequired}</strong>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        </div>
    `;

    // 6. Hospital
    const hospital = escapeHtml(request.hospitalName || 'N/A');

    // 7. City
    const city = `📍 ${escapeHtml(request.city || 'N/A')}`;

    // 8. Contact
    const contact = request.contactNumber || 'N/A';
    const contactHtml = `
        <div>
            ${contact}
            ${contact !== 'N/A' ? '<br><small style="color: #6b7280;">📞 📋</small>' : ''}
        </div>
    `;

    // 9. Urgency
    const urgency = calculateUrgency(request.inquiryDate, request.status, request.urgency);
    const urgencyHtml = `<span class="urgency-badge ${urgency.level}">${urgency.icon} ${urgency.text}</span>`;

    // 10. Created By
    const createdBy = `👤 ${escapeHtml(request.createdBy || 'Unknown')}`;

    // 11. Verified By
    const verifiedBy = request.verifiedBy
        ? `✅ ${escapeHtml(request.verifiedBy)}`
        : '<span style="color: #9ca3af;">❌ Not Verified</span>';

    // 12. Actions
    const actionsHtml = `
        <button class="action-btn" onclick="viewRequest(${index})" title="View Details">
            👁️ View
        </button>
    `;

    tr.innerHTML = `
        <td>${statusBadge}</td>
        <td>
            <div>${requestDate}</div>
            <small style="color: #6b7280;">${timeAgo}</small>
        </td>
        <td>${patientName}</td>
        <td>${bloodGroup}</td>
        <td>${unitsHtml}</td>
        <td>${hospital}</td>
        <td>${city}</td>
        <td>${contactHtml}</td>
        <td>${urgencyHtml}</td>
        <td><small>${createdBy}</small></td>
        <td><small>${verifiedBy}</small></td>
        <td>${actionsHtml}</td>
    `;

    return tr;
}

// ============================================================================
// VIEW REQUEST DETAILS
// ============================================================================
window.viewRequest = function (index) {
    const actualIndex = (currentPage - 1) * requestsPerPage + index;
    const request = allRequests[actualIndex];

    if (!request) {
        console.error('Request not found:', index);
        return;
    }
    populateModal(request);
    document.getElementById('viewModal').classList.add('active');
};

// ============================================================================
// POPULATE MODAL
// ============================================================================
async function populateModal(request) {
    // Overview Tab
    const overview = document.getElementById('tabOverview');
    overview.innerHTML = `
        ${createRequestStatusCard(request)}
        ${createBloodRequirementCard(request)}
        ${createPatientSummaryCard(request)}
        ${createHospitalSummaryCard(request)}
        ${createTrackingCard(request)}
    `;

    // Details Tab
    const details = document.getElementById('tabDetails');
    details.innerHTML = `
        ${createPatientDetailsCard(request)}
        ${createHospitalDetailsCard(request)}
    `;

    // Donations Tab
    const donations = document.getElementById('tabDonations');
    const donationHistory = await fetchDonationHistory(request);
    donations.innerHTML = createDonationHistoryContent(request, donationHistory);

    // History Tab
    const history = document.getElementById('tabHistory');
    const requestHistory = await fetchRequestHistory(request);
    history.innerHTML = createRequestHistoryContent(requestHistory);
}

// ============================================================================
// MODAL CONTENT CREATORS
// ============================================================================
function createRequestStatusCard(request) {
    const statusClass = request.status.toLowerCase();
    const urgency = calculateUrgency(request.inquiryDate, request.status, request.urgency);

    return `
        <div class="info-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <h3 style="color: white;">
                <span class="status-badge ${statusClass}" style="background: rgba(255,255,255,0.3);">
                    ${request.status.toUpperCase()}
                </span>
            </h3>
            <div class="info-row" style="grid-template-columns: 1fr;">
                <div>
                    <strong>Request ID:</strong> ${request.id || 'N/A'}<br>
                    <strong>Created:</strong> ${formatDateTime(request.inquiryDate)} (${getTimeAgo(request.inquiryDate)})<br>
                    <strong>Urgency:</strong> ${urgency.icon} ${urgency.text}
                </div>
            </div>
        </div>
    `;
}

function createBloodRequirementCard(request) {
    const unitsRequired = parseInt(request.unitsRequired) || 0;
    const unitsFulfilled = parseInt(request.unitsFulfilled) || 0;
    const unitsRemaining = unitsRequired - unitsFulfilled;
    const percentage = unitsRequired > 0 ? Math.round((unitsFulfilled / unitsRequired) * 100) : 0;

    return `
        <div class="info-card">
            <h3>🩸 Blood Requirement</h3>
            <div class="info-row">
                <div class="info-label">Blood Group Required:</div>
                <div class="info-value"><strong style="color: #dc2626; font-size: 18px;">${request.bloodType}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Units Required:</div>
                <div class="info-value"><strong>${unitsRequired} Units</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Units Fulfilled:</div>
                <div class="info-value"><strong>${unitsFulfilled} Units</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Units Remaining:</div>
                <div class="info-value"><strong style="color: ${unitsRemaining > 0 ? '#dc2626' : '#059669'};">${unitsRemaining} Units</strong></div>
            </div>
            <div style="margin-top: 15px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Progress: ${percentage}%</div>
                <div class="progress-bar" style="height: 10px;">
                    <div class="progress-fill ${percentage === 0 ? 'zero' : percentage < 100 ? 'partial' : ''}" 
                         style="width: ${percentage}%"></div>
                </div>
            </div>
        </div>
    `;
}

function createPatientSummaryCard(request) {
    return `
        <div class="info-card">
            <h3>👤 Patient Information</h3>
            <div class="info-row">
                <div class="info-label">Name:</div>
                <div class="info-value"><strong>${escapeHtml(request.patientName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Age:</div>
                <div class="info-value">${request.patientAge || 'N/A'} years</div>
            </div>
            <div class="info-row">
                <div class="info-label">Diagnosis:</div>
                <div class="info-value">${escapeHtml(request.diagnosis || 'N/A')}</div>
            </div>
        </div>
    `;
}

function createHospitalSummaryCard(request) {
    return `
        <div class="info-card">
            <h3>🏥 Hospital Information</h3>
            <div class="info-row">
                <div class="info-label">Hospital:</div>
                <div class="info-value"><strong>${escapeHtml(request.hospitalName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">City:</div>
                <div class="info-value">${escapeHtml(request.city || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Address:</div>
                <div class="info-value">${escapeHtml(request.hospitalAddress || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Person:</div>
                <div class="info-value">${escapeHtml(request.contactPerson || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Number:</div>
                <div class="info-value">
                    <strong>${request.contactNumber || 'N/A'}</strong>
                    ${request.contactNumber ? ' <a href="tel:' + request.contactNumber + '" style="color: #667eea;">📞 Call</a>' : ''}
                </div>
            </div>
        </div>
    `;
}

function createTrackingCard(request) {
    return `
        <div class="info-card">
            <h3>📊 Request Tracking</h3>
            <div class="info-row">
                <div class="info-label">Created By:</div>
                <div class="info-value">👤 ${escapeHtml(request.createdBy || 'Unknown')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Created At:</div>
                <div class="info-value">${formatDateTime(request.inquiryDate)}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Verified By:</div>
                <div class="info-value">${request.verifiedBy ? '✅ ' + escapeHtml(request.verifiedBy) : '❌ Not Verified'}</div>
            </div>
            ${request.status === 'Closed' ? `
                <div class="info-row">
                    <div class="info-label">Closed By:</div>
                    <div class="info-value">${escapeHtml(request.closedBy || 'N/A')}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Closure Reason:</div>
                    <div class="info-value">${escapeHtml(request.closureReason || 'N/A')}</div>
                </div>
            ` : ''}
            <div class="info-row">
                <div class="info-label">Reopen Count:</div>
                <div class="info-value">${request.reopenCount || 0}</div>
            </div>
        </div>
    `;
}

function createPatientDetailsCard(request) {
    return `
        <div class="info-card">
            <h3>👤 Complete Patient Details</h3>
            <div class="info-row">
                <div class="info-label">Full Name:</div>
                <div class="info-value"><strong>${escapeHtml(request.patientName || 'N/A')}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Age:</div>
                <div class="info-value">${request.patientAge || 'N/A'} years</div>
            </div>
            <div class="info-row">
                <div class="info-label">Blood Group Needed:</div>
                <div class="info-value"><strong style="color: #dc2626;">${request.bloodType}</strong></div>
            </div>
            <div class="info-row" style="grid-template-columns: 1fr;">
                <div>
                    <div class="info-label" style="margin-bottom: 8px;">Medical Condition:</div>
                    <div class="info-value" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        ${escapeHtml(request.diagnosis || 'No diagnosis information provided')}
                    </div>
                </div>
            </div>
            ${request.additionalInfo ? `
                <div class="info-row" style="grid-template-columns: 1fr;">
                    <div>
                        <div class="info-label" style="margin-bottom: 8px;">Additional Notes:</div>
                        <div class="info-value" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                            ${escapeHtml(request.additionalInfo)}
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function createHospitalDetailsCard(request) {
    return `
        <div class="info-card">
            <h3>🏥 Complete Hospital Details</h3>
            <div class="info-row">
                <div class="info-label">Hospital Name:</div>
                <div class="info-value"><strong>${escapeHtml(request.hospitalName || 'N/A')}</strong></div>
            </div>
            <div class="info-row" style="grid-template-columns: 1fr;">
                <div>
                    <div class="info-label" style="margin-bottom: 8px;">Full Address:</div>
                    <div class="info-value" style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        ${escapeHtml(request.hospitalAddress || 'N/A')}<br>
                        ${escapeHtml(request.city || 'N/A')}
                    </div>
                </div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Person:</div>
                <div class="info-value">${escapeHtml(request.contactPerson || 'N/A')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Contact Number:</div>
                <div class="info-value">
                    <strong>${request.contactNumber || 'N/A'}</strong><br>
                    ${request.contactNumber ? `
                        <a href="tel:${request.contactNumber}" style="color: #667eea; text-decoration: none;">📞 Call</a> | 
                        <a href="https://wa.me/91${request.contactNumber}" target="_blank" style="color: #25D366; text-decoration: none;">💬 WhatsApp</a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function createDonationHistoryContent(request, donations) {
    const unitsRequired = parseInt(request.unitsRequired) || 0;
    const unitsFulfilled = parseInt(request.unitsFulfilled) || 0;
    const unitsRemaining = unitsRequired - unitsFulfilled;

    let html = `
        <div class="info-card">
            <h3>🩸 Donation Summary</h3>
            <div class="info-row">
                <div class="info-label">Total Units Required:</div>
                <div class="info-value"><strong>${unitsRequired}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Total Units Donated:</div>
                <div class="info-value"><strong>${unitsFulfilled}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Remaining Units:</div>
                <div class="info-value"><strong style="color: ${unitsRemaining > 0 ? '#dc2626' : '#059669'};">${unitsRemaining}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">Number of Donors:</div>
                <div class="info-value"><strong>${donations.length}</strong></div>
            </div>
            ${request.donors ? `
                <div class="info-row" style="grid-template-columns: 1fr;">
                    <div>
                        <div class="info-label">Donor Summary:</div>
                        <div class="info-value">${escapeHtml(request.donors)}</div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    if (donations.length > 0) {
        donations.forEach((donation, index) => {
            html += `
                <div class="info-card">
                    <h3>🩸 Donation #${index + 1}</h3>
                    <div class="info-row">
                        <div class="info-label">Donor Name:</div>
                        <div class="info-value"><strong>${escapeHtml(donation.donorName || 'Anonymous')}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Donor Contact:</div>
                        <div class="info-value">${donation.donorContact || 'N/A'}</div>
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
                <p style="color: #9ca3af; margin-top: 10px;">This request has not received any donations yet.</p>
            </div>
        `;
    }

    return html;
}

function createRequestHistoryContent(history) {
    if (!history || history.length === 0) {
        return `
            <div class="info-card" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📜</div>
                <h3 style="color: #6b7280;">No History Available</h3>
                <p style="color: #9ca3af; margin-top: 10px;">No activity history found for this request.</p>
            </div>
        `;
    }

    let html = '<div class="timeline">';

    history.forEach((event) => {
        const icon = getEventIcon(event.type);
        html += `
            <div class="timeline-item">
                <div class="timeline-icon" style="border-color: ${getEventColor(event.type)};"></div>
                <div class="timeline-content">
                    <div class="timeline-time">${formatDateTime(event.timestamp)}</div>
                    <div class="timeline-title">${icon} ${event.type}</div>
                    <div class="timeline-details">
                        ${event.userName ? `By: ${escapeHtml(event.userName)}<br>` : ''}
                        ${event.note ? escapeHtml(event.note) : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// ============================================================================
// FETCH DONATION HISTORY
// ============================================================================
async function fetchDonationHistory(request) {
    try {
        if (!request.id) return [];

        const donationsRef = collection(db, 'donation_logs');
        const q = query(donationsRef, where('requestId', '==', request.id));
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
// FETCH REQUEST HISTORY
// ============================================================================
async function fetchRequestHistory(request) {
    try {
        if (!request.id) return [];

        const historyRef = collection(db, 'emergency_requests', request.id, 'updates');
        const snapshot = await getDocs(historyRef);

        const history = [];
        snapshot.forEach((doc) => {
            history.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by timestamp (newest first)
        history.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
        });

        return history;
    } catch (error) {
        console.error('Error fetching request history:', error);
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
// PAGINATION (Gallery-style with ellipsis)
// ============================================================================
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    const totalPages = Math.ceil(allRequests.length / requestsPerPage);

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
    const showPages = 5; // Number of page buttons to show around current page
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
    }

    // Show first page and ellipsis if needed
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-page" data-page="1">1</button>
        `;
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
        paginationHTML += `
            <button class="pagination-page ${lastPageActive}" data-page="${totalPages}">${totalPages}</button>
        `;
    }

    // Update first page if it's active and shown separately
    if (startPage > 1 && currentPage === 1) {
        paginationHTML = paginationHTML.replace(
            '<button class="pagination-page" data-page="1">1</button>',
            '<button class="pagination-page active" data-page="1">1</button>'
        );
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
// UTILITY FUNCTIONS
// ============================================================================
function formatDateTime(date) {
    if (!date) return 'N/A';

    // Handle Firebase Timestamp objects
    let d;
    if (date && typeof date === 'object' && date.seconds) {
        // Firebase Timestamp
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
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${day} ${month} ${year}, ${displayHours}:${minutes} ${ampm}`;
}

function getTimeAgo(date) {
    if (!date) return '';

    // Handle Firebase Timestamp objects
    let d;
    if (date && typeof date === 'object' && date.seconds) {
        // Firebase Timestamp
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function calculateUrgency(inquiryDate, status, urgencyLevel) {
    // If request is closed, show as normal
    if (status === 'Closed') {
        return { level: 'normal', icon: '🟢', text: 'Normal' };
    }

    // Use the urgency level from database if available
    if (urgencyLevel) {
        const level = urgencyLevel.toLowerCase();
        if (level === 'critical') {
            return { level: 'critical', icon: '🔴', text: 'Critical' };
        } else if (level === 'urgent') {
            return { level: 'urgent', icon: '🟡', text: 'Urgent' };
        } else {
            return { level: 'normal', icon: '🟢', text: 'Normal' };
        }
    }

    // Fallback: Calculate based on time if no urgency level is set
    const now = new Date();
    const requestDate = inquiryDate instanceof Date ? inquiryDate : new Date(inquiryDate);
    const hoursSince = (now - requestDate) / (1000 * 60 * 60);

    if (hoursSince < 2) {
        return { level: 'critical', icon: '🔴', text: 'Critical' };
    } else if (hoursSince < 6) {
        return { level: 'urgent', icon: '🟡', text: 'Urgent' };
    } else {
        return { level: 'normal', icon: '🟢', text: 'Normal' };
    }
}

function getEventIcon(type) {
    const icons = {
        'CREATED': '🔵',
        'VERIFIED': '✅',
        'EDITED': '✏️',
        'DONATION': '🩸',
        'CLOSED': '🟢',
        'REOPENED': '🔄'
    };
    return icons[type] || '📝';
}

function getEventColor(type) {
    const colors = {
        'CREATED': '#3b82f6',
        'VERIFIED': '#10b981',
        'EDITED': '#f59e0b',
        'DONATION': '#dc2626',
        'CLOSED': '#059669',
        'REOPENED': '#6366f1'
    };
    return colors[type] || '#667eea';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
