// ==========================================
// EMERGENCY REQUEST FILTER, SORT & SEARCH
// ==========================================

// Store all requests for filtering/sorting
let allRequests = [];
let currentFilters = {
    search: '',
    bloodGroup: 'all',
    urgency: 'all',
    hospital: 'all',
    status: 'open-verified' // Default to show Open & Verified
};
let currentSort = 'latest';

// Initialize filter/sort system
function initializeFilterSort() {
    const searchInput = document.getElementById('searchInput');
    const sortChips = document.querySelectorAll('.sort-chip');
    const bloodGroupFilter = document.getElementById('bloodGroupFilter');
    const urgencyFilter = document.getElementById('urgencyFilter');
    const hospitalFilter = document.getElementById('hospitalFilter');
    const statusFilter = document.getElementById('statusFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterPanel = document.getElementById('filterPanel');
    const filterCountBadge = document.getElementById('filterCountBadge');

    if (!searchInput || !sortChips.length) {
        console.log('Filter/Sort elements not found, skipping initialization');
        return;
    }

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = e.target.value.toLowerCase().trim();
            console.log('🔍 Search input changed to:', currentFilters.search);
            applyFiltersAndSort();
        }, 300);
    });

    // Sort chip buttons
    sortChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Remove active class from all chips
            sortChips.forEach(c => c.classList.remove('active'));
            // Add active class to clicked chip
            chip.classList.add('active');
            // Update sort
            currentSort = chip.dataset.sort;
            applyFiltersAndSort();
        });
    });

    // Filter toggle button
    if (filterToggleBtn && filterPanel) {
        filterToggleBtn.addEventListener('click', () => {
            const isHidden = filterPanel.classList.contains('hidden');
            if (isHidden) {
                filterPanel.classList.remove('hidden');
                filterToggleBtn.classList.add('active');
            } else {
                filterPanel.classList.add('hidden');
                filterToggleBtn.classList.remove('active');
            }
        });
    }

    // Filter dropdowns
    if (bloodGroupFilter) {
        bloodGroupFilter.addEventListener('change', (e) => {
            currentFilters.bloodGroup = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (urgencyFilter) {
        urgencyFilter.addEventListener('change', (e) => {
            currentFilters.urgency = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (hospitalFilter) {
        hospitalFilter.addEventListener('change', (e) => {
            currentFilters.hospital = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            applyFiltersAndSort();
        });
    }

    // Clear all filters
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Reset all filters
            currentFilters = {
                search: '',
                bloodGroup: 'all',
                urgency: 'all',
                hospital: 'all',
                status: 'open-verified'
            };
            currentSort = 'latest';

            // Reset UI
            searchInput.value = '';

            // Reset sort chips
            sortChips.forEach(c => c.classList.remove('active'));
            document.querySelector('[data-sort="latest"]')?.classList.add('active');

            // Reset filters
            if (bloodGroupFilter) bloodGroupFilter.value = 'all';
            if (urgencyFilter) urgencyFilter.value = 'all';
            if (hospitalFilter) hospitalFilter.value = 'all';
            if (statusFilter) statusFilter.value = 'open-verified';

            applyFiltersAndSort();
        });
    }
}

// Store requests when loaded
function storeRequests(requests) {
    console.log('🔍 storeRequests called with', requests.length, 'requests');
    allRequests = requests || [];

    // Populate hospital filter dropdown
    populateHospitalFilter();

    // Apply default filters and sort
    applyFiltersAndSort();
}

// Populate hospital filter with unique hospitals
function populateHospitalFilter() {
    const hospitalFilter = document.getElementById('hospitalFilter');
    if (!hospitalFilter) return;

    // Get unique hospitals
    const hospitals = [...new Set(allRequests.map(r => r.hospitalName).filter(Boolean))];
    hospitals.sort();

    // Clear existing options except "All Hospitals"
    hospitalFilter.innerHTML = '<option value="all">All Hospitals</option>';

    // Add hospital options
    hospitals.forEach(hospital => {
        const option = document.createElement('option');
        option.value = hospital;
        option.textContent = hospital;
        hospitalFilter.appendChild(option);
    });
}

// Apply filters and sorting
function applyFiltersAndSort() {
    console.log('🔍 applyFiltersAndSort called. Total requests:', allRequests.length);
    console.log('🔍 Current search filter:', currentFilters.search);

    let filteredRequests = [...allRequests];

    // Apply search filter (minimum 3 characters)
    if (currentFilters.search && currentFilters.search.length >= 3) {
        console.log('🔍 Applying search filter for:', currentFilters.search);

        filteredRequests = filteredRequests.filter(request => {
            const searchTerm = currentFilters.search;
            const patientName = (request.patientName || '').toLowerCase();
            const contactNumber = String(request.contactNumber || '').toLowerCase();
            const contactPerson = (request.contactPerson || '').toLowerCase();

            const matches = patientName.includes(searchTerm) ||
                contactNumber.includes(searchTerm) ||
                contactPerson.includes(searchTerm);

            if (matches) {
                console.log('✅ Match found:', request.patientName, request.contactNumber);
            }

            return matches;
        });

        console.log('🔍 Filtered to', filteredRequests.length, 'requests');
    } else if (currentFilters.search) {
        console.log('⚠️ Search term too short (< 3 chars):', currentFilters.search);
    }
    // If search term is less than 3 characters, show all results (don't filter)

    // Apply blood group filter
    // Exact matching with case-insensitive comparison
    // 'any' shows only requests with bloodType 'any' (case-insensitive)
    // 'A+' shows only requests with bloodType 'A+', etc.
    if (currentFilters.bloodGroup !== 'all') {
        filteredRequests = filteredRequests.filter(request => {
            const requestBloodType = (request.bloodType || '').toLowerCase();
            const filterBloodGroup = currentFilters.bloodGroup.toLowerCase();
            return requestBloodType === filterBloodGroup;
        });
    }

    // Apply urgency filter
    if (currentFilters.urgency !== 'all') {
        filteredRequests = filteredRequests.filter(request => {
            const urgency = (request.urgency || 'normal').toLowerCase();
            return urgency === currentFilters.urgency;
        });
    }

    // Apply hospital filter
    if (currentFilters.hospital !== 'all') {
        filteredRequests = filteredRequests.filter(request =>
            request.hospitalName === currentFilters.hospital
        );
    }

    // Apply status filter
    if (currentFilters.status !== 'all') {
        filteredRequests = filteredRequests.filter(request => {
            const status = (request.status || 'Open').toLowerCase();

            if (currentFilters.status === 'open-verified') {
                return status === 'open' || status === 'verified';
            } else if (currentFilters.status === 'open') {
                return status === 'open';
            } else if (currentFilters.status === 'verified') {
                return status === 'verified';
            } else if (currentFilters.status === 'closed') {
                return status === 'closed';
            }
            return true;
        });
    }

    // Apply sorting
    filteredRequests = sortRequests(filteredRequests, currentSort);

    // Display filtered and sorted requests
    displayFilteredRequests(filteredRequests);

    // Update active filters display
    updateActiveFiltersDisplay();
}

// Sort requests based on selected option
function sortRequests(requests, sortType) {
    const sorted = [...requests];

    switch (sortType) {
        case 'latest':
            // Sort by date (newest first)
            sorted.sort((a, b) => {
                const dateA = new Date(a.inquiryDate);
                const dateB = new Date(b.inquiryDate);
                return dateB - dateA;
            });
            break;

        case 'oldest':
            // Sort by date (oldest first)
            sorted.sort((a, b) => {
                const dateA = new Date(a.inquiryDate);
                const dateB = new Date(b.inquiryDate);
                return dateA - dateB;
            });
            break;

        case 'urgency':
            // Sort by urgency (Critical > Urgent > Normal)
            const urgencyOrder = { 'critical': 0, 'urgent': 1, 'normal': 2 };
            sorted.sort((a, b) => {
                const urgencyA = (a.urgency || 'normal').toLowerCase();
                const urgencyB = (b.urgency || 'normal').toLowerCase();
                const orderA = urgencyOrder[urgencyA] ?? 2;
                const orderB = urgencyOrder[urgencyB] ?? 2;

                if (orderA !== orderB) {
                    return orderA - orderB;
                }

                // If same urgency, sort by date (newest first)
                const dateA = new Date(a.inquiryDate);
                const dateB = new Date(b.inquiryDate);
                return dateB - dateA;
            });
            break;

        default:
            // Default to latest
            sorted.sort((a, b) => {
                const dateA = new Date(a.inquiryDate);
                const dateB = new Date(b.inquiryDate);
                return dateB - dateA;
            });
    }

    return sorted;
}

// Display filtered requests
function displayFilteredRequests(requests) {
    const container = document.getElementById('emergencyRequestsContainer');
    const loadingState = document.getElementById('loadingState');
    const noRequestsState = document.getElementById('noRequestsState');

    if (!container) return;

    // Clear existing cards (except loading/no requests states)
    const existingCards = container.querySelectorAll('.emergency-request-card');
    existingCards.forEach(card => card.remove());

    // Hide loading state
    if (loadingState) loadingState.classList.add('hidden');

    if (requests.length === 0) {
        // Show no requests state
        if (noRequestsState) {
            noRequestsState.classList.remove('hidden');
            noRequestsState.innerHTML = `
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <h3 class="text-xl font-semibold text-text-primary mb-2">No Matching Requests</h3>
                <p class="text-text-secondary">No requests match your current filters. Try adjusting your search criteria.</p>
            `;
        }
    } else {
        // Hide no requests state
        if (noRequestsState) noRequestsState.classList.add('hidden');

        // Display each filtered request
        requests.forEach((request, index) => {
            try {
                const requestCard = createRequestCard(request);
                container.appendChild(requestCard);

                // Initialize button states based on request status
                const cardKey = `${request.patientName}-${request.bloodType}`;
                const requestStatus = request.status || 'Open';

                if (requestStatus === 'Verified') {
                    buttonStates.set(cardKey, { verifyStatus: 'verified' });
                } else if (requestStatus === 'Closed') {
                    buttonStates.set(cardKey, { closeStatus: 'closed' });
                }
            } catch (error) {
                console.error(`Error creating card for request ${index}:`, error, request);
            }
        });
    }

    // Update active requests count
    updateActiveRequestsCount(requests.length);
}

// Update active requests count badge
function updateActiveRequestsCount(count) {
    const activeRequestsNumber = document.getElementById('activeRequestsNumber');
    if (activeRequestsNumber) {
        activeRequestsNumber.textContent = count;
    }
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const activeFiltersDisplay = document.getElementById('activeFiltersDisplay');
    const filterCountBadge = document.getElementById('filterCountBadge');
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterPanel = document.getElementById('filterPanel');

    if (!activeFiltersDisplay) return;

    activeFiltersDisplay.innerHTML = '';

    const filters = [];

    // Search filter (only show if 3+ characters)
    if (currentFilters.search && currentFilters.search.length >= 3) {
        filters.push({
            label: `Search: "${currentFilters.search}"`,
            key: 'search'
        });
    }

    // Blood group filter
    if (currentFilters.bloodGroup !== 'all') {
        filters.push({
            label: `Blood: ${currentFilters.bloodGroup}`,
            key: 'bloodGroup'
        });
    }

    // Urgency filter
    if (currentFilters.urgency !== 'all') {
        filters.push({
            label: `Urgency: ${currentFilters.urgency.charAt(0).toUpperCase() + currentFilters.urgency.slice(1)}`,
            key: 'urgency'
        });
    }

    // Hospital filter
    if (currentFilters.hospital !== 'all') {
        filters.push({
            label: `Hospital: ${currentFilters.hospital}`,
            key: 'hospital'
        });
    }

    // Status filter (only show if not default)
    if (currentFilters.status !== 'open-verified') {
        const statusLabels = {
            'all': 'All Status',
            'open': 'Open Only',
            'verified': 'Verified Only',
            'closed': 'Closed Only'
        };
        filters.push({
            label: `Status: ${statusLabels[currentFilters.status]}`,
            key: 'status'
        });
    }

    // Update filter count badge
    const activeFilterCount = filters.length;
    if (filterCountBadge) {
        if (activeFilterCount > 0) {
            filterCountBadge.textContent = activeFilterCount;
            filterCountBadge.classList.remove('hidden');
        } else {
            filterCountBadge.classList.add('hidden');
        }
    }

    // Auto-open filter panel if filters are active
    if (activeFilterCount > 0 && filterPanel && filterToggleBtn) {
        filterPanel.classList.remove('hidden');
        filterToggleBtn.classList.add('active');
    }

    // Create filter tags
    filters.forEach(filter => {
        const tag = document.createElement('span');
        tag.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary text-white';
        tag.innerHTML = `
            ${filter.label}
            <button class="ml-2 hover:text-gray-200" data-filter-key="${filter.key}">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        `;

        // Add click handler to remove individual filter
        tag.querySelector('button').addEventListener('click', () => {
            removeFilter(filter.key);
        });

        activeFiltersDisplay.appendChild(tag);
    });
}

// Remove individual filter
function removeFilter(filterKey) {
    switch (filterKey) {
        case 'search':
            currentFilters.search = '';
            document.getElementById('searchInput').value = '';
            break;
        case 'bloodGroup':
            currentFilters.bloodGroup = 'all';
            document.getElementById('bloodGroupFilter').value = 'all';
            break;
        case 'urgency':
            currentFilters.urgency = 'all';
            document.getElementById('urgencyFilter').value = 'all';
            break;
        case 'hospital':
            currentFilters.hospital = 'all';
            document.getElementById('hospitalFilter').value = 'all';
            break;
        case 'status':
            currentFilters.status = 'open-verified';
            document.getElementById('statusFilter').value = 'open-verified';
            break;
    }

    applyFiltersAndSort();
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeFilterSort();
});
