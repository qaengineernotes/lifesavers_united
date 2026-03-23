import re

with open("scripts/donors.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. State Variables
code = code.replace("""// Global state
let currentUser = null;
let allDonors = [];
let filteredDonors = []; // For search and filter results
let searchQuery = '';    // Current search query
let activeFilters = {
    bloodGroup: '',
    city: '',
    emergency: ''
};
let currentSort = {
    key: 'registeredAt',
    dir: 'desc'
};
let currentPage = 1;""", """// Global state
let currentUser = null;
let currentDonorsPage = []; // Holds the exact 20 donors for the current page
let searchQuery = '';    // Exact Contact Number match
let activeFilters = {
    bloodGroup: '',
    city: '',
    emergency: ''
};
let currentSort = {
    key: 'registeredAt',
    dir: 'desc'
};

// --- PAGINATION STATE ---
let currentPage = 1;         
let pageCursors = { 1: null }; // Maps pageNumber -> the last document snapshot of the previous page
let isFetchingDocs = false;  """)

# 2. DOMContentLoaded call
code = code.replace("""        // User is logged in and approved
        await loadAllDonors();""", """        // User is logged in and approved
        updateStatistics();
        populateCityFilter();
        
        // Reset and fetch first page
        currentPage = 1;
        pageCursors = { 1: null };
        await fetchAndRenderPage();""")

# 3. loadAllDonors replacement
block3_start = code.find("// ============================================================================\n// LOAD ALL DONORS")
block3_end = code.find("// ============================================================================\n// UPDATE STATISTICS")
if block3_start != -1 and block3_end != -1:
    new_block3 = """// ============================================================================
// SERVER-SIDE FETCHING & PAGINATION
// ============================================================================
async function fetchAndRenderPage() {
    if (isFetchingDocs) return;
    isFetchingDocs = true;

    try {
        if (currentPage === 1) {
            document.getElementById('loadingState').style.display = 'block';
            document.getElementById('tableContainer').style.display = 'none';
        }

        const donorsRef = collection(db, 'donors');
        let queryConstraints = [];

        // 1. FILTERING
        // Exact contact number match instead of full text search for server performance
        if (searchQuery) {
            // strip non-numeric just in case
            let cleanNumber = searchQuery.replace(/\D/g, '');
            if (cleanNumber.startsWith('91') && cleanNumber.length > 10) {
                 cleanNumber = cleanNumber.substring(2);
            }
            if (cleanNumber.length > 10) cleanNumber = cleanNumber.slice(-10);
            queryConstraints.push(where('contactNumber', '==', cleanNumber || searchQuery));
        }
        if (activeFilters.bloodGroup) {
            queryConstraints.push(where('bloodGroup', '==', activeFilters.bloodGroup));
        }
        if (activeFilters.city) {
            queryConstraints.push(where('city', '==', activeFilters.city));
        }
        if (activeFilters.emergency) {
            const emergencyValue = activeFilters.emergency === 'yes' ? 'yes' : 'no';
            queryConstraints.push(where('isEmergencyAvailable', '==', emergencyValue));
        }

        // 2. SORTING
        queryConstraints.push(orderBy(currentSort.key, currentSort.dir));

        // 3. PAGINATION
        const cursorDoc = pageCursors[currentPage];
        if (cursorDoc) {
            queryConstraints.push(startAfter(cursorDoc));
        }
        queryConstraints.push(limit(PAGE_SIZE));

        // EXECUTE QUERY
        const finalQuery = query(donorsRef, ...queryConstraints);
        const snapshot = await getDocs(finalQuery);

        currentDonorsPage = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Store the cursor for the NEXT page
        if (snapshot.docs.length === PAGE_SIZE) {
            pageCursors[currentPage + 1] = snapshot.docs[snapshot.docs.length - 1];
        } else {
            pageCursors[currentPage + 1] = null; // No next page
        }

        renderTable(); 
        updatePaginationUI(snapshot.docs.length);

        if (currentPage === 1) {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('tableContainer').style.display = 'block';
        }
    } catch (error) {
        console.error("Error fetching page:", error);
        const tbody = document.getElementById('donorsTableBody');
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 40px; color: #dc2626;">Error loading data: ${error.message} <br> Firebase may require a new composite index for this exact sorting/filtering combination. Check Developer Console (F12) for the creation link.</td></tr>`;
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'block';
    } finally {
        isFetchingDocs = false;
    }
}

"""
    code = code[:block3_start] + new_block3 + code[block3_end:]

# 4. populateCityFilter replacement
block4_start = code.find("function populateCityFilter() {")
block4_end = code.find("// ============================================================================\n// RENDER TABLE")
if block4_start != -1 and block4_end != -1:
    new_block4 = """function populateCityFilter() {
    // Static list of popular cities in Gujarat for dropdown (since server-side UNIQUE/DISTINCT is unavailable without complex triggers)
    const defaultCities = ['Ahmedabad', 'Gandhinagar', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Anand', 'Nadiad', 'Morbi', 'Mehsana'];
    
    const cityFilter = document.getElementById('filterCity');
    cityFilter.innerHTML = '<option value="">All Cities</option>';
    
    defaultCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });

    updateCityCustomDropdown(defaultCities);
}

"""
    code = code[:block4_start] + new_block4 + code[block4_end:]

# 5. renderTable replacement
block5_start = code.find("function renderTable() {")
block5_end = code.find("// ============================================================================\n// CREATE TABLE ROW")
if block5_start != -1 and block5_end != -1:
    new_block5 = """function renderTable() {
    const tbody = document.getElementById('donorsTableBody');
    tbody.innerHTML = '';

    updateHeaderSortUI(); // Highlight sorting column headers

    if (currentDonorsPage.length === 0) {
        const message = searchQuery || activeFilters.bloodGroup || activeFilters.city || activeFilters.emergency
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

    currentDonorsPage.forEach((donor, index) => {
        const startIndex = (currentPage - 1) * PAGE_SIZE; // just for rendering row number if needed
        const row = createTableRow(donor, startIndex + index);
        tbody.appendChild(row);
    });

    // Removed updateFilterResults() as we no longer calculate precise full-table matching lengths natively
}

"""
    code = code[:block5_start] + new_block5 + code[block5_end:]

# 6. viewDonor replacement
code = code.replace("""window.viewDonor = function (donorId) {
    // Look up by stable Firestore document ID — never stale, no index offset math
    let donor = filteredDonors.find(d => d.id === donorId);
    if (!donor) {
        // Fallback: donor may have been filtered out since the row was rendered
        donor = allDonors.find(d => d.id === donorId);
    }""", """window.viewDonor = function (donorId) {
    // Look up by stable Firestore document ID
    let donor = currentDonorsPage.find(d => d.id === donorId);""")

# 7. Edit performSearch to fetchAndRenderPage
code = code.replace("""    currentPage = 1;
    renderTable();

    // Update search results display""", """    currentPage = 1;
    pageCursors = { 1: null };
    fetchAndRenderPage();

    // Update search results display""")
code = code.replace("""    if (searchQuery && filteredDonors.length > 0) {
        searchResults.textContent = `Found ${filteredDonors.length} donor${filteredDonors.length === 1 ? '' : 's'}`;
        searchResults.classList.add('visible');
    } else if (searchQuery) {
        searchResults.textContent = `No results found`;
        searchResults.classList.add('visible');
    } else {
        searchResults.classList.remove('visible');
    }""", """    if (searchQuery) {
        searchResults.textContent = `Searching for exact contact "${searchQuery}"`;
        searchResults.classList.add('visible');
    } else {
        searchResults.classList.remove('visible');
    }""")

# 8. Filter and Sorting changes - all renderTable calls must become fetchAndRenderPage
code = code.replace("""        if (currentValue !== value) {
            activeFilters.bloodGroup = value;
            currentPage = 1;
            renderTable();
        }""", """        if (currentValue !== value) {
            activeFilters.bloodGroup = value;
            currentPage = 1;
            pageCursors = { 1: null };
            fetchAndRenderPage();
        }""")
code = code.replace("""        if (currentValue !== value) {
            activeFilters.city = value;
            currentPage = 1;
            renderTable();
        }""", """        if (currentValue !== value) {
            activeFilters.city = value;
            currentPage = 1;
            pageCursors = { 1: null };
            fetchAndRenderPage();
        }""")
code = code.replace("""        if (currentValue !== value) {
            activeFilters.emergency = value;
            currentPage = 1;
            renderTable();
        }""", """        if (currentValue !== value) {
            activeFilters.emergency = value;
            currentPage = 1;
            pageCursors = { 1: null };
            fetchAndRenderPage();
        }""")
code = code.replace("""        activeFilters = { bloodGroup: '', city: '', emergency: '' };
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        
        // Reset dropdowns visual state
        document.getElementById('filterBloodGroup').value = '';
        document.getElementById('filterCity').value = '';
        document.getElementById('filterEmergency').value = '';
        
        // Reset custom dropdowns if they exist
        document.querySelectorAll('.custom-select .selected').forEach(el => {
            el.textContent = el.parentElement.querySelector('.dropdown-option[data-value=""]').textContent;
            el.dataset.value = '';
        });

        currentPage = 1;
        renderTable();""", """        activeFilters = { bloodGroup: '', city: '', emergency: '' };
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        
        document.getElementById('filterBloodGroup').value = '';
        document.getElementById('filterCity').value = '';
        document.getElementById('filterEmergency').value = '';
        
        document.querySelectorAll('.custom-select .selected').forEach(el => {
            el.textContent = el.parentElement.querySelector('.dropdown-option[data-value=""]').textContent;
            el.dataset.value = '';
        });

        currentPage = 1;
        pageCursors = { 1: null };
        fetchAndRenderPage();""")

code = code.replace("""            // Toggle direction or change key
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'desc'; // Default new sort to descending
            }

            renderTable();""", """            // Toggle direction or change key
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'desc'; // Default new sort to descending
            }

            currentPage = 1;
            pageCursors = { 1: null };
            fetchAndRenderPage();""")

# 9. updatePagination -> updatePaginationUI
block9_start = code.find("function updatePagination()")
block9_end = code.find("// ============================================================================\n// SEARCH AND FILTER COMBINED INITIALIZATION")
if block9_start != -1 and block9_end != -1:
    new_block9 = """function updatePaginationUI(docsReturned) {
    const paginationContainer = document.getElementById('pagination');
    
    // If no records at all and we're on page 1, hide pagination
    if (currentPage === 1 && docsReturned === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="pagination-prev" 
                ${currentPage === 1 ? 'disabled' : ''}
                aria-label="Previous page">
            « Previous
        </button>
        
        <span class="pagination-page active" style="padding: 8px 16px; cursor: default;">
            Page ${currentPage}
        </span>

        <button class="pagination-next" 
                ${!pageCursors[currentPage + 1] ? 'disabled' : ''}
                aria-label="Next page">
            Next »
        </button>
    `;

    paginationContainer.innerHTML = paginationHTML;

    const prevBtn = paginationContainer.querySelector('.pagination-prev');
    const nextBtn = paginationContainer.querySelector('.pagination-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchAndRenderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (pageCursors[currentPage + 1]) {
                currentPage++;
                fetchAndRenderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

"""
    code = code[:block9_start] + new_block9 + code[block9_end:]

with open("scripts/donors.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Modification complete!")
