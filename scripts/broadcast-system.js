// Broadcast Email System for Admin Dashboard
import { getCurrentUser, onAuthChange } from './firebase-auth-service.js';

export function initializeBroadcastSystem() {
    const broadcastBtnContainer = document.getElementById('broadcastButtonContainer');
    const modal = document.getElementById('broadcastModal');
    const closeBtn = document.getElementById('closeBroadcastModal');
    const cancelBtn = document.getElementById('cancelBroadcast');
    const form = document.getElementById('broadcastForm');
    const submitBtn = document.getElementById('submitBroadcast');
    const btnText = document.getElementById('broadcastBtnText');
    const btnLoader = document.getElementById('broadcastBtnLoader');

    if (!broadcastBtnContainer || !modal) return;

    // 1. Authorization: Only show button for Superusers
    onAuthChange((user) => {
        if (user && user.role === 'superuser' && user.status === 'approved') {
            broadcastBtnContainer.classList.remove('hidden');
            broadcastBtnContainer.style.display = 'inline-flex';
        } else {
            broadcastBtnContainer.classList.add('hidden');
            broadcastBtnContainer.style.display = 'none';
        }
    });

    // 2. Modal Controls
    const openModal = (e) => {
        if (e) e.preventDefault();
        console.log('Opening Broadcast Modal (Direct Style)...');
        if (modal) {
            modal.style.setProperty('display', 'flex', 'important');
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            console.error('Modal element not found!');
        }
    };

    const closeModal = () => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            form.reset();
        }
    };

    // Use multiple attachment points for robustness
    broadcastBtnContainer.onclick = openModal;
    broadcastBtnContainer.addEventListener('click', openModal);
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // 3. Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = getCurrentUser();
        if (!user || user.role !== 'superuser') {
            alert('Unauthorized: Only Superusers can send broadcasts.');
            return;
        }

        const subject = document.getElementById('broadcastSubject').value.trim();
        const message = document.getElementById('broadcastMessage').value.trim();

        if (!subject || !message) {
            alert('Please fill in both subject and message.');
            return;
        }

        // Confirmation before sending to EVERYONE
        if (!confirm(`Are you sure you want to send this email to ALL registered donors?`)) {
            return;
        }

        // Loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
        btnLoader.classList.remove('hidden');

        try {
            const response = await fetch('/broadcast-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject,
                    message,
                    adminUid: user.uid
                }),
            });

            const result = await response.json();

            if (result.success) {
                showToast('Success!', result.message, 'success');
                closeModal();
            } else {
                showToast('Failed', result.error || 'Something went wrong.', 'error');
            }
        } catch (error) {
            console.error('Broadcast Error:', error);
            showToast('Error', 'Failed to connect to the broadcast service.', 'error');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Send Broadcast';
            btnLoader.classList.add('hidden');
        }
    });
}

// ── Helper: Simple Toast Notification ────────────────────────────────────────
function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    
    toast.className = `fixed bottom-8 right-8 ${bgColor} text-white px-6 py-4 rounded-2xl shadow-2xl z-[1000] flex items-center animate-slide-up`;
    toast.innerHTML = `
        <div class="mr-3">
            ${type === 'success' 
                ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            }
        </div>
        <div>
            <div class="font-bold">${title}</div>
            <div class="text-sm opacity-90">${message}</div>
        </div>
    `;

    document.body.appendChild(toast);

    // Style for toast animation
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slide-up {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
