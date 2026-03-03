// ==========================================
// EMERGENCY REQUEST FILTER, SORT & SEARCH (PREMIUM REDESIGN)
// ==========================================

// Store all requests for filtering/sorting
let allRequests = [];
let currentFilters = {
    search: '',
    bloodGroup: 'all',
    urgency: 'all',
    hospital: 'all'
};
let currentSort = 'latest';

// Initialize filter/sort system
function initializeFilterSort() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const sortChips = document.querySelectorAll('.sort-chip-premium');
    const bloodGroupFilter = document.getElementById('bloodGroupFilter');
    const urgencyFilter = document.getElementById('urgencyFilter');
    const hospitalFilter = document.getElementById('hospitalFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn'); // Clear All

    if (!searchInput || !sortChips.length) {
        console.warn('Search or Sort elements not found');
        return;
    }

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('show', value.length > 0);
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = value.toLowerCase();
            applyFiltersAndSort();
        }, 300);
    });

    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.remove('show');
            currentFilters.search = '';
            applyFiltersAndSort();
            searchInput.focus();
        });
    }

    // Sort chip buttons
    sortChips.forEach(chip => {
        chip.addEventListener('click', () => {
            sortChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentSort = chip.dataset.sort;
            applyFiltersAndSort();
        });
    });

    // Native Filter sync event listeners
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

    // Clear all filters
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            resetAllFilters();
        });
    }

    setupCustomDropdowns();
}

/**
 * Resets all filters to their default states
 */
function resetAllFilters() {
    currentFilters = {
        search: '',
        bloodGroup: 'all',
        urgency: 'all',
        hospital: 'all'
    };
    currentSort = 'latest';

    // Reset UI
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        document.getElementById('clearSearchBtn')?.classList.remove('show');
    }

    // Reset sort chips
    const sortChips = document.querySelectorAll('.sort-chip-premium');
    sortChips.forEach(c => c.classList.remove('active'));
    document.querySelector('[data-sort="latest"]')?.classList.add('active');

    // Reset native selects
    if (document.getElementById('bloodGroupFilter')) document.getElementById('bloodGroupFilter').value = 'all';
    if (document.getElementById('urgencyFilter')) document.getElementById('urgencyFilter').value = 'all';
    if (document.getElementById('hospitalFilter')) document.getElementById('hospitalFilter').value = 'all';

    // Reset Custom Dropdowns UI
    syncCustomDropdownsFromNative();

    applyFiltersAndSort();
}

/**
 * Custom Dropdown Logic Implementation
 */
function setupCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.cdd-trigger');
        const nativeSelect = dropdown.querySelector('select');
        const labelEl = dropdown.querySelector('.cdd-label');

        if (!trigger || !nativeSelect || !labelEl) return;

        // Sync initial state
        const initialText = nativeSelect.options[nativeSelect.selectedIndex]?.text;
        labelEl.textContent = initialText || 'Select';

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close others
            dropdowns.forEach(other => {
                if (other !== dropdown) {
                    other.classList.remove('active');
                    const otherTrigger = other.querySelector('.cdd-trigger');
                    if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
                }
            });

            const isActive = dropdown.classList.toggle('active');
            trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });

        // Option selection
        dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.cdd-option');
            if (!option) return;

            const value = option.dataset.value;
            const text = option.textContent;

            // Update custom UI
            labelEl.textContent = text;
            dropdown.querySelectorAll('.cdd-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Sync with native select
            if (nativeSelect.value !== value) {
                nativeSelect.value = value;
                nativeSelect.dispatchEvent(new Event('change'));
            }

            // Close dropdown
            dropdown.classList.remove('active');
            trigger.setAttribute('aria-expanded', 'false');
        });
    });

    // Close on outside click
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
            const trigger = dropdown.querySelector('.cdd-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    });
}

function syncCustomDropdownsFromNative() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        const nativeSelect = dropdown.querySelector('select');
        const labelEl = dropdown.querySelector('.cdd-label');
        if (!nativeSelect || !labelEl) return;

        const val = nativeSelect.value;
        const text = nativeSelect.options[nativeSelect.selectedIndex]?.text;

        labelEl.textContent = text;
        dropdown.querySelectorAll('.cdd-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === val);
        });
    });
}

// Store requests when loaded
function storeRequests(requests) {
    allRequests = requests || [];
    populateHospitalFilter();
    applyFiltersAndSort();
}

// Populate hospital filter with unique hospitals from active requests
function populateHospitalFilter() {
    const hospitalFilter = document.getElementById('hospitalFilter');
    const hospitalPanel = document.querySelector('#dropHospital .cdd-panel');
    if (!hospitalFilter || !hospitalPanel) return;

    // Get unique hospitals from active requests (allRequests is now pre-filtered by the data service)
    const hospitals = [...new Set(allRequests.map(r => r.hospitalName).filter(Boolean))];
    hospitals.sort();

    // Clear existing
    hospitalFilter.innerHTML = '<option value="all">All Hospitals</option>';
    hospitalPanel.innerHTML = '<li class="cdd-option selected" data-value="all" role="option">All Hospitals</li>';

    hospitals.forEach(hospital => {
        // Native option
        const option = document.createElement('option');
        option.value = hospital;
        option.textContent = hospital;
        hospitalFilter.appendChild(option);

        // Custom option
        const li = document.createElement('li');
        li.className = 'cdd-option';
        li.dataset.value = hospital;
        li.setAttribute('role', 'option');
        li.textContent = `📍 ${hospital}`;
        hospitalPanel.appendChild(li);
    });
}

// Apply filters and sorting
function applyFiltersAndSort() {
    let filteredRequests = [...allRequests];

    // Apply search filter
    if (currentFilters.search) {
        filteredRequests = filteredRequests.filter(request => {
            const searchTerm = currentFilters.search;
            const patientName = (request.patientName || '').toLowerCase();
            const contactNumber = String(request.contactNumber || '').toLowerCase();
            return patientName.includes(searchTerm) || contactNumber.includes(searchTerm);
        });
    }

    // Apply blood group filter
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

    // Apply sorting
    filteredRequests = sortRequests(filteredRequests, currentSort);

    // Display
    displayFilteredRequests(filteredRequests);

    // Update active filters display
    updateActiveFiltersDisplay();
}

// Sort requests based on selected option
function sortRequests(requests, sortType) {
    const sorted = [...requests];
    switch (sortType) {
        case 'latest':
            sorted.sort((a, b) => new Date(b.inquiryDate) - new Date(a.inquiryDate));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.inquiryDate) - new Date(b.inquiryDate));
            break;
        case 'urgency':
            const urgencyOrder = { 'critical': 0, 'urgent': 1, 'normal': 2 };
            sorted.sort((a, b) => {
                const orderA = urgencyOrder[(a.urgency || 'normal').toLowerCase()] ?? 2;
                const orderB = urgencyOrder[(b.urgency || 'normal').toLowerCase()] ?? 2;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.inquiryDate) - new Date(a.inquiryDate);
            });
            break;
    }
    return sorted;
}

// Display filtered requests
function displayFilteredRequests(requests) {
    const container = document.getElementById('emergencyRequestsContainer');
    const loadingState = document.getElementById('loadingState');
    const noRequestsState = document.getElementById('noRequestsState');

    if (!container) return;

    // Clear existing cards
    const existingCards = container.querySelectorAll('.emergency-request-card');
    existingCards.forEach(card => card.remove());

    if (loadingState) loadingState.classList.add('hidden');

    if (requests.length === 0) {
        if (noRequestsState) {
            noRequestsState.classList.remove('hidden');
            noRequestsState.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">No Matching Requests</h3>
                    <p class="text-gray-500 max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
                </div>
            `;
        }
    } else {
        if (noRequestsState) noRequestsState.classList.add('hidden');
        requests.forEach(request => {
            try {
                if (typeof createRequestCard === 'function') {
                    const card = createRequestCard(request);
                    container.appendChild(card);
                }
            } catch (error) {
                console.error('Error creating request card:', error, request);
            }
        });
    }

    updateActiveRequestsCount(requests.length);
}

function updateActiveRequestsCount(count) {
    const el = document.getElementById('activeRequestsNumber');
    if (el) el.textContent = count;
}

function updateActiveFiltersDisplay() {
    const display = document.getElementById('activeFiltersDisplay');
    if (!display) return;
    display.innerHTML = '';

    const filters = [];
    if (currentFilters.search) filters.push({ label: `Search: "${currentFilters.search}"`, key: 'search' });
    if (currentFilters.bloodGroup !== 'all') filters.push({ label: `Blood: ${currentFilters.bloodGroup}`, key: 'bloodGroup' });
    if (currentFilters.urgency !== 'all') filters.push({ label: `Urgency: ${currentFilters.urgency}`, key: 'urgency' });
    if (currentFilters.hospital !== 'all') filters.push({ label: `Hospital: ${currentFilters.hospital}`, key: 'hospital' });

    filters.forEach(f => {
        const tag = document.createElement('div');
        tag.className = 'inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 transition-all hover:bg-red-100';
        tag.innerHTML = `
            <span>${f.label}</span>
            <button class="hover:text-red-800" onclick="removeFilter('${f.key}')">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        `;
        display.appendChild(tag);
    });
}

function removeFilter(key) {
    if (key === 'search') {
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearchBtn')?.classList.remove('show');
        currentFilters.search = '';
    } else {
        const selectMap = {
            'bloodGroup': 'bloodGroupFilter',
            'urgency': 'urgencyFilter',
            'hospital': 'hospitalFilter'
        };
        const defaultVals = {
            'bloodGroup': 'all',
            'urgency': 'all',
            'hospital': 'all'
        };
        const elId = selectMap[key];
        if (elId) {
            const select = document.getElementById(elId);
            if (select) {
                select.value = defaultVals[key];
                currentFilters[key] = defaultVals[key];
                syncCustomDropdownsFromNative();
            }
        }
    }
    applyFiltersAndSort();
}

// Global scope expose for inline onclick
window.removeFilter = removeFilter;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeFilterSort();
});
