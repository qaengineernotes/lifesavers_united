/**
 * Stories Page JavaScript
 * Shows full stories in expanded cards + Share functionality
 */

let allStories = [];
let currentFilter = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    loadStories();
    setupEventListeners();
    injectShareToastContainer();
});

/* ─────────────────────────────────────────
   DATA LOADING
───────────────────────────────────────── */

async function loadStories() {
    try {
        const response = await fetch('/data/stories.json');
        const data = await response.json();
        allStories = data.stories;

        updateStats(data.stats);

        const sortedStories = [...allStories].sort((a, b) => new Date(b.date) - new Date(a.date));
        displayStories(sortedStories);

    } catch (error) {
        console.error('Error loading stories:', error);
        showError('Unable to load stories. Please try again later.');
    }
}

/* ─────────────────────────────────────────
   FILTERS
───────────────────────────────────────── */

function setupEventListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterAndDisplayStories();
        });
    });
}

function filterAndDisplayStories() {
    let filteredStories = [...allStories];

    if (currentFilter !== 'all') {
        filteredStories = filteredStories.filter(story => story.type === currentFilter);
    }

    filteredStories = filteredStories.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayStories(filteredStories);
}

/* ─────────────────────────────────────────
   DISPLAY
───────────────────────────────────────── */

function displayStories(stories) {
    const storiesGrid = document.getElementById('storiesGrid');
    if (!storiesGrid) return;

    storiesGrid.innerHTML = '';

    if (stories.length === 0) {
        storiesGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl text-gray-500">No stories found matching your criteria.</p>
                <p class="text-gray-400 mt-2">Try adjusting your filters or search terms.</p>
            </div>
        `;
        return;
    }

    stories.forEach(story => {
        storiesGrid.appendChild(createStoryCard(story));
    });
}

/* ─────────────────────────────────────────
   CARD CREATION
───────────────────────────────────────── */

function createStoryCard(story) {
    const card = document.createElement('div');
    card.className = 'story-card bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-smooth mb-8 relative';
    card.id = `story-card-${story.id}`;

    const typeInfo = getStoryTypeInfo(story.type);
    const dateFormatted = formatDate(story.date);

    card.innerHTML = `
        <!-- Share icon – top right of the whole card -->
        <button
            id="share-btn-${story.id}"
            onclick="shareStory(${story.id})"
            style="position:absolute;top:12px;right:12px;z-index:10;"
            class="p-2 rounded-full bg-white bg-opacity-90 hover:bg-gray-100 transition-colors shadow-sm"
            title="Share this story">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
            </svg>
        </button>

        <div class="grid md:grid-cols-3 gap-0">
            <!-- Image Section (1/3 width) -->
            <div class="relative md:col-span-1">
                <img src="${story.image}" alt="${story.title}" 
                     class="w-full h-full object-cover min-h-[300px]"
                     crossorigin="anonymous"
                     onerror="this.src='https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'">
                <div class="absolute top-4 left-4">
                    <span class="badge badge-${story.type}">
                        ${typeInfo.icon}
                        ${typeInfo.label}
                    </span>
                </div>
            </div>
            
            <!-- Content Section (2/3 width) -->
            <div class="md:col-span-2 p-6 md:p-8">
                <h3 class="text-2xl font-bold text-gray-800 mb-3">${story.title}</h3>
                
                <div class="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
                    <span class="flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                        </svg>
                        ${story.name}
                    </span>
                    ${story.age ? `<span> • </span><span>Age ${story.age}</span>` : ''}
                    ${story.bloodGroup ? `<span> • </span><span>${story.bloodGroup}</span>` : ''}
                    <span> • </span>
                    <span>${dateFormatted}</span>
                </div>
                
                ${getStoryMetrics(story)}
                
                <div class="max-w-none mt-4 mb-4">
                    <p class="text-gray-700 leading-relaxed">${story.fullStory}</p>
                </div>
                
                ${story.testimonial ? `
                <div class="bg-accent-50 border-l-4 border-accent rounded-lg p-4 mb-4">
                    <svg class="w-6 h-6 text-accent mb-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                    </svg>
                    <p class="text-base italic text-gray-700">"${story.testimonial}"</p>
                    <p class="text-sm text-gray-500 mt-2">- ${story.name}</p>
                </div>
                ` : ''}
                
                ${story.outcome ? `
                <div class="bg-green-50 rounded-lg p-3 flex items-center mb-4">
                    <svg class="w-5 h-5 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    <div>
                        <p class="font-semibold text-green-800 text-sm">Outcome: ${story.outcome}</p>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    return card;
}

/* ─────────────────────────────────────────
   SHARE FUNCTIONALITY
───────────────────────────────────────── */

/**
 * Called when user clicks the share icon on a story card.
 * Opens a modal identical to emergency_request_system's showShareOptions().
 */
function shareStory(storyId) {
    const story = allStories.find(s => s.id === storyId);
    if (!story) return;

    const cardEl = document.getElementById(`story-card-${storyId}`);
    const quote = story.testimonial || story.motivation || story.excerpt || '';
    const shareText = `${story.name}\n\n"${quote}"\n\n🔗 https://lifesaversunited.org/stories`;
    const pageUrl = 'https://lifesaversunited.org/stories';
    const fileName = `${story.name.replace(/\s+/g, '-').toLowerCase()}-story.png`;

    // ── Build modal (identical layout to emergency_request_system)
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        position: relative;
        z-index: 1000000;
    `;
    modalContent.innerHTML = `
        <div style="text-align:center; margin-bottom:24px;">
            <div style="width:64px;height:64px;background-color:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <svg style="width:32px;height:32px;color:#2563eb;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                </svg>
            </div>
            <h3 style="font-size:24px;font-weight:bold;color:#1f2937;margin-bottom:8px;">Share Story</h3>
            <p style="color:#6b7280;">Choose how you want to share this story</p>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
            <!-- WhatsApp -->
            <button id="storyWhatsappBtn" style="display:flex;align-items:center;padding:16px;border:1px solid #d1d5db;border-radius:12px;background-color:#25D366;color:white;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%;">
                <svg style="width:24px;height:24px;margin-right:12px;flex-shrink:0;" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                </svg>
                <span>Share on WhatsApp</span>
            </button>

            <!-- Download Poster (captures card as image) -->
            <button id="storyDownloadBtn" style="display:flex;align-items:center;padding:16px;border:1px solid #d1d5db;border-radius:12px;background-color:#DC2626;color:white;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%;">
                <svg style="width:24px;height:24px;margin-right:12px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                <span>Download Story Image</span>
            </button>

            <!-- Facebook -->
            <button id="storyFacebookBtn" style="display:flex;align-items:center;padding:16px;border:1px solid #d1d5db;border-radius:12px;background-color:#1877f2;color:white;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%;">
                <svg style="width:24px;height:24px;margin-right:12px;flex-shrink:0;" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Share on Facebook</span>
            </button>

            <!-- X / Twitter -->
            <button id="storyTwitterBtn" style="display:flex;align-items:center;padding:16px;border:1px solid #d1d5db;border-radius:12px;background-color:#000000;color:white;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%;">
                <svg style="width:24px;height:24px;margin-right:12px;flex-shrink:0;" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Share on X (Twitter)</span>
            </button>

            <!-- Copy to Clipboard -->
            <button id="storyCopyBtn" style="display:flex;align-items:center;padding:16px;border:1px solid #d1d5db;border-radius:12px;background-color:white;color:#374151;font-weight:500;cursor:pointer;transition:all 0.2s ease;width:100%;">
                <svg style="width:24px;height:24px;margin-right:12px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span>Copy to Clipboard</span>
            </button>
        </div>

        <div style="display:flex;gap:12px;margin-top:24px;">
            <button id="storyCancelBtn" style="flex:1;padding:12px 16px;border:1px solid #d1d5db;border-radius:8px;color:#374151;font-weight:500;background-color:white;cursor:pointer;transition:all 0.2s ease;">
                Cancel
            </button>
        </div>
    `;

    // ── Hover effects
    const whatsappBtn = modalContent.querySelector('#storyWhatsappBtn');
    const downloadBtn = modalContent.querySelector('#storyDownloadBtn');
    const facebookBtn = modalContent.querySelector('#storyFacebookBtn');
    const twitterBtn = modalContent.querySelector('#storyTwitterBtn');
    const copyBtn = modalContent.querySelector('#storyCopyBtn');
    const cancelBtn = modalContent.querySelector('#storyCancelBtn');

    whatsappBtn.addEventListener('mouseenter', () => whatsappBtn.style.backgroundColor = '#1faa59');
    whatsappBtn.addEventListener('mouseleave', () => whatsappBtn.style.backgroundColor = '#25D366');
    downloadBtn.addEventListener('mouseenter', () => downloadBtn.style.backgroundColor = '#b91c1c');
    downloadBtn.addEventListener('mouseleave', () => downloadBtn.style.backgroundColor = '#DC2626');
    facebookBtn.addEventListener('mouseenter', () => facebookBtn.style.backgroundColor = '#166fe5');
    facebookBtn.addEventListener('mouseleave', () => facebookBtn.style.backgroundColor = '#1877f2');
    twitterBtn.addEventListener('mouseenter', () => twitterBtn.style.backgroundColor = '#333333');
    twitterBtn.addEventListener('mouseleave', () => twitterBtn.style.backgroundColor = '#000000');
    copyBtn.addEventListener('mouseenter', () => copyBtn.style.backgroundColor = '#f3f4f6');
    copyBtn.addEventListener('mouseleave', () => copyBtn.style.backgroundColor = 'white');
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.backgroundColor = '#f3f4f6');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.backgroundColor = 'white');

    // ── WhatsApp
    whatsappBtn.addEventListener('click', () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
        modal.remove();
    });

    // ── Download Story Image (html2canvas capture)
    downloadBtn.addEventListener('click', async () => {
        const origHTML = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
            <svg style="width:24px;height:24px;margin-right:12px;animation:spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Generating…</span>
        `;
        try {
            const canvas = await html2canvas(cardEl, {
                useCORS: true,
                allowTaint: false,
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });
            downloadCanvas(canvas, fileName);
            showShareToast('✅ Story image downloaded!');
            modal.remove();
        } catch (err) {
            console.error('Download failed:', err);
            showShareToast('⚠️ Could not generate image. Please try again.', 'error');
            downloadBtn.innerHTML = origHTML;
            downloadBtn.disabled = false;
        }
    });

    // ── Facebook
    facebookBtn.addEventListener('click', () => {
        copyToClipboard(shareText).catch(() => { });
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
        window.open(fbUrl, '_blank', 'width=600,height=400');
        setTimeout(() => showShareToast('Text copied! Paste it in the Facebook post.'), 400);
        modal.remove();
    });

    // ── Twitter / X
    twitterBtn.addEventListener('click', () => {
        const twitterShareText = `${story.name} — "${quote}" #LifeSaversUnited #BloodDonation`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterShareText)}&url=${encodeURIComponent(pageUrl)}`;
        window.open(tweetUrl, '_blank', 'width=600,height=400');
        modal.remove();
    });

    // ── Copy to Clipboard
    copyBtn.addEventListener('click', async () => {
        await copyToClipboard(shareText);
        showShareToast('✅ Copied to clipboard!');
        modal.remove();
    });

    // ── Cancel
    cancelBtn.addEventListener('click', () => modal.remove());

    // ── Click outside to close
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // ── Escape key to close
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
    });

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

/** Convert canvas to Blob (promise wrapper) */
function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
    });
}

/** Trigger image download from canvas */
function downloadCanvas(canvas, fileName) {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/** Copy text to clipboard */
async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        // Legacy fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
}

/* ─────────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────────── */

function injectShareToastContainer() {
    if (document.getElementById('share-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'share-toast-container';
    container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
}

function showShareToast(message, type = 'success') {
    const container = document.getElementById('share-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'error' ? '#dc2626' : '#1f2937'};
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        opacity: 0;
        transform: translateY(12px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
        white-space: nowrap;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
    });

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 350);
    }, 3000);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

function getStoryTypeInfo(type) {
    const types = {
        patient: {
            label: 'Patient Story',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path></svg>'
        },
        donor: {
            label: 'Donor Story',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>'
        },
        emergency: {
            label: 'Emergency Response',
            icon: '<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
        }
    };
    return types[type] || types.patient;
}

function getStoryMetrics(story) {
    let metrics = '';

    if (story.type === 'donor') {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    <strong>${story.donationCount}+</strong>&nbsp;Donations
                </div>
                <div class="flex items-center text-accent bg-accent-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    <strong>${story.yearsActive}</strong>&nbsp;Years
                </div>
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.donationType}
                </div>
            </div>
        `;
    } else if (story.type === 'emergency') {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                <div class="flex items-center text-warning bg-orange-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.responseTime}
                </div>
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"></path>
                    </svg>
                    ${story.donorsMobilized} Donors
                </div>
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.unitsFulfilled}/${story.unitsRequired} Units
                </div>
            </div>
        `;
    } else {
        metrics = `
            <div class="flex flex-wrap gap-3 text-sm mb-4">
                ${story.unitsRequired ? `
                <div class="flex items-center text-secondary bg-secondary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                    </svg>
                    ${story.unitsRequired} Units
                </div>
                ` : ''}
                <div class="flex items-center text-accent bg-accent-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.location}
                </div>
                ${story.hospital ? `
                <div class="flex items-center text-primary bg-primary-50 px-3 py-1.5 rounded-full">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" clip-rule="evenodd"></path>
                    </svg>
                    ${story.hospital}
                </div>
                ` : ''}
            </div>
        `;
    }

    return metrics;
}

function updateStats(stats) {
    const statElements = {
        totalStories: document.getElementById('totalStories'),
        totalDonors: document.getElementById('totalDonors'),
        totalPatients: document.getElementById('totalPatients')
    };

    if (statElements.totalStories) statElements.totalStories.textContent = stats.totalStories;
    if (statElements.totalDonors) statElements.totalDonors.textContent = stats.totalDonors;
    if (statElements.totalPatients) statElements.totalPatients.textContent = stats.totalPatients;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showError(message) {
    const storiesGrid = document.getElementById('storiesGrid');
    if (storiesGrid) {
        storiesGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl text-gray-700 mb-2">Oops! Something went wrong</p>
                <p class="text-gray-500">${message}</p>
            </div>
        `;
    }
}
