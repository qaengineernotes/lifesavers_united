// User Profile UI Component
// Displays logged-in user info with logout option

import { getCurrentUser, onAuthChange, signOut } from './firebase-auth-service.js';

// ============================================================================
// INITIALIZE USER PROFILE UI
// ============================================================================
export function initializeUserProfileUI() {
    // Listen for auth state changes
    onAuthChange((user) => {
        if (user) {
            showUserProfile(user);
            // Show/hide All Requests button based on user status
            toggleAllRequestsButton(user);
        } else {
            hideUserProfile();
            toggleAllRequestsButton(null);
        }
    });

    // Check current user on load
    const currentUser = getCurrentUser();
    if (currentUser) {
        showUserProfile(currentUser);
        toggleAllRequestsButton(currentUser);
    }
}

// ============================================================================
// TOGGLE ALL REQUESTS AND ALL DONORS BUTTON VISIBILITY
// ============================================================================
function toggleAllRequestsButton(user) {
    // Try to find the All Requests button container (in emergency_request_system.html)
    const allRequestsButtonContainer = document.getElementById('allRequestsButtonContainer');

    if (allRequestsButtonContainer) {
        if (user && user.status === 'approved') {
            allRequestsButtonContainer.style.display = 'inline-flex';
            allRequestsButtonContainer.style.visibility = 'visible';
            allRequestsButtonContainer.style.opacity = '1';
        } else {
            allRequestsButtonContainer.style.display = 'none';
        }
    }

    // Try to find the All Donors button container (in emergency_request_system.html)
    const allDonorsButtonContainer = document.getElementById('allDonorsButtonContainer');

    if (allDonorsButtonContainer) {
        if (user && user.status === 'approved') {
            allDonorsButtonContainer.style.display = 'inline-flex';
            allDonorsButtonContainer.style.visibility = 'visible';
            allDonorsButtonContainer.style.opacity = '1';
        } else {
            allDonorsButtonContainer.style.display = 'none';
        }
    }

    // Also handle the old navigation link if it exists (for backward compatibility)
    const allRequestsLink = document.getElementById('allRequestsLink');
    if (allRequestsLink) {
        if (user && user.status === 'approved') {
            allRequestsLink.style.display = 'inline';
        } else {
            allRequestsLink.style.display = 'none';
        }
    }
}

// ============================================================================
// SHOW USER PROFILE INDICATOR
// ============================================================================
function showUserProfile(user) {
    // Remove existing profile if any
    const existing = document.getElementById('userProfileIndicator');
    if (existing) existing.remove();

    // Get initials from display name
    const initials = getInitials(user.displayName || user.phoneNumber);

    // Create profile container
    const profileContainer = document.createElement('div');
    profileContainer.id = 'userProfileIndicator';
    profileContainer.style.cssText = `
        position: fixed;
        top: 5px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create profile button
    const profileButton = document.createElement('div');
    profileButton.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        border: 3px solid white;
    `;
    profileButton.textContent = initials;
    profileButton.title = user.displayName || user.phoneNumber;

    // Hover effect
    profileButton.addEventListener('mouseenter', () => {
        profileButton.style.transform = 'scale(1.1)';
        profileButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        showDropdown();
    });

    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.id = 'userDropdown';
    dropdown.style.cssText = `
        position: absolute;
        top: 60px;
        right: 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        min-width: 240px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        overflow: hidden;
    `;

    dropdown.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #1f2937; font-size: 16px; margin-bottom: 4px;">
                ${escapeHtml(user.displayName || 'User')}
            </div>
            <div style="font-size: 13px; color: #6b7280;">
                ${escapeHtml(user.phoneNumber || '')}
            </div>
        </div>
        <div style="padding: 8px;">
            <button id="logoutBtn" style="
                width: 100%;
                padding: 12px 16px;
                background: transparent;
                border: none;
                border-radius: 8px;
                color: #dc2626;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            ">
                <svg style="width: 18px; height: 18px;" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
                </svg>
                <span>Logout</span>
            </button>
        </div>
    `;

    // Hover effects for dropdown
    profileContainer.addEventListener('mouseenter', () => {
        showDropdown();
    });

    profileContainer.addEventListener('mouseleave', () => {
        hideDropdown();
    });

    function showDropdown() {
        dropdown.style.opacity = '1';
        dropdown.style.visibility = 'visible';
        dropdown.style.transform = 'translateY(0)';
    }

    function hideDropdown() {
        dropdown.style.opacity = '0';
        dropdown.style.visibility = 'hidden';
        dropdown.style.transform = 'translateY(-10px)';
    }

    // Logout button hover effect
    const logoutBtn = dropdown.querySelector('#logoutBtn');
    logoutBtn.addEventListener('mouseenter', () => {
        logoutBtn.style.backgroundColor = '#fee2e2';
    });
    logoutBtn.addEventListener('mouseleave', () => {
        logoutBtn.style.backgroundColor = 'transparent';
    });

    // Logout functionality
    logoutBtn.addEventListener('click', async () => {
        showConfirmPopup({
            title: 'Confirm Logout',
            message: 'Are you sure you want to log out?',
            confirmLabel: 'Yes, Logout',
            cancelLabel: 'Cancel',
            onConfirm: async () => {
                const success = await signOut();
                if (success) {
                    hideUserProfile();
                    showSuccessToast('Logged out successfully');
                    setTimeout(() => { location.reload(); }, 1000);
                }
            }
        });
    });

    // Assemble components
    profileContainer.appendChild(profileButton);
    profileContainer.appendChild(dropdown);
    document.body.appendChild(profileContainer);
}

// ============================================================================
// HIDE USER PROFILE INDICATOR
// ============================================================================
function hideUserProfile() {
    const existing = document.getElementById('userProfileIndicator');
    if (existing) {
        existing.remove();
    }
}

// ============================================================================
// GET INITIALS FROM NAME
// ============================================================================
function getInitials(name) {
    if (!name) return '?';

    // If it's a phone number, return first 2 digits
    if (name.startsWith('+')) {
        return name.substring(1, 3);
    }

    // Get initials from name
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
        return parts[0].substring(0, 2).toUpperCase();
    }
}

// ============================================================================
// CUSTOM CONFIRM POPUP
// ============================================================================
function showConfirmPopup({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm }) {
    // Remove any existing popup
    const existing = document.getElementById('customConfirmPopup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'customConfirmPopup';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: fadeInOverlay 0.2s ease;
    `;

    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 380px;
            width: 90%;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
            animation: popIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
        ">
            <!-- Header with gradient -->
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                <div style="
                    width: 40px; height: 40px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                ">
                    <svg style="width:20px;height:20px;color:white;" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h3 style="margin:0; font-size:18px; font-weight:700; color:white;">${escapeHtml(title)}</h3>
            </div>

            <!-- Body -->
            <div style="padding: 24px;">
                <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">${escapeHtml(message)}</p>

                <div style="display: flex; gap: 12px;">
                    <button id="confirmPopupCancel" style="
                        flex: 1; padding: 11px 16px;
                        border: 1.5px solid #d1d5db;
                        border-radius: 8px;
                        background: white;
                        color: #374151;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">${escapeHtml(cancelLabel)}</button>

                    <button id="confirmPopupOk" style="
                        flex: 1; padding: 11px 16px;
                        border: none;
                        border-radius: 8px;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
                        transition: opacity 0.2s;
                    ">${escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        </div>
        <style>
            @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
            @keyframes popIn { from { transform: scale(0.85); opacity:0; } to { transform: scale(1); opacity:1; } }
            #confirmPopupCancel:hover { background: #f3f4f6 !important; }
            #confirmPopupOk:hover { opacity: 0.9 !important; }
        </style>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('#confirmPopupCancel');
    const okBtn = overlay.querySelector('#confirmPopupOk');

    function close() { overlay.remove(); }

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    okBtn.addEventListener('click', () => {
        close();
        if (typeof onConfirm === 'function') onConfirm();
    });
}

// ============================================================================
// ESCAPE HTML
// ============================================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// SHOW SUCCESS TOAST
// ============================================================================
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        z-index: 999999;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
        style.remove();
    }, 3000);
}
