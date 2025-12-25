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
        } else {
            hideUserProfile();
        }
    });

    // Check current user on load
    const currentUser = getCurrentUser();
    if (currentUser) {
        showUserProfile(currentUser);
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
        if (confirm('Are you sure you want to logout?')) {
            const success = await signOut();
            if (success) {
                hideUserProfile();
                showSuccessToast('Logged out successfully');
                // Optionally reload the page
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        }
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
