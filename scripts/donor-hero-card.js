/**
 * LifeSavers United - Hero Card Generator & Canvas Rendering Engine
 * Generates official studio-quality social appreciation cards with dynamic milestones,
 * donor photo fitting, and one-click WhatsApp/Social sharing.
 */

import { getCurrentUser, onAuthChange } from './firebase-auth-service.js';

// Configuration constants matching imgs/hero_card_template_transperent.png (1254 x 1254)
const CANVAS_WIDTH = 1254;
const CANVAS_HEIGHT = 1254;

// Photo frame geometry (measured precisely from the transparent template)
const FRAME_CENTER_X = 906;
const FRAME_CENTER_Y = 545;
const FRAME_ROTATION_RAD = (5.2 * Math.PI) / 180; // ~5.2 degrees tilt
const FRAME_WINDOW_WIDTH = 580;
const FRAME_WINDOW_HEIGHT = 710;

// Gold Plaque & Medal positions
const PLAQUE_CENTER_X = 311;
const PLAQUE_CENTER_Y = 450;
const MEDAL_CENTER_X = 948;
const MEDAL_CENTER_Y = 818;

// State management
let templateImage = null;
let userUploadedImage = null;
let isTemplateLoaded = false;
let currentRenderBlob = null;
let currentDonorSession = null;

// Photo transform controls state
const photoState = {
    zoom: 1.0,
    panX: 0,
    panY: 0
};

/**
 * Calculate ordinal suffix for milestone (e.g. 1st, 2nd, 3rd, 103rd)
 */
export function getOrdinalSuffix(n) {
    const num = parseInt(n, 10);
    if (isNaN(num) || num <= 0) return '';
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

/**
 * Determine suitable pronouns based on honorific or gender
 */
function getPronouns(honorific) {
    const h = (honorific || '').trim().toLowerCase();
    if (h.includes('ms') || h.includes('mrs') || h.includes('miss') || h.includes('smt')) {
        return { poss: 'her', obj: 'her', subj: 'She' };
    }
    if (h.includes('mr') || h.includes('shri')) {
        return { poss: 'his', obj: 'him', subj: 'He' };
    }
    return { poss: 'their', obj: 'them', subj: 'They' };
}

/**
 * Load template image into memory
 */
export async function loadCardTemplate() {
    if (templateImage && isTemplateLoaded) return templateImage;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            templateImage = img;
            isTemplateLoaded = true;
            resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load hero card template'));
        img.src = 'imgs/hero_card_template_transperent.png';
    });
}

/**
 * Render the complete Hero Card onto an HTML5 Canvas
 */
export async function renderHeroCard(canvas, data = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 1. Ensure template image is loaded
    if (!templateImage || !isTemplateLoaded) {
        try {
            await loadCardTemplate();
        } catch (e) {
            console.error('Template loading warning:', e);
        }
    }

    // 2. Ensure custom fonts are ready
    if (document.fonts) {
        try {
            await Promise.allSettled([
                document.fonts.load('800 48px Inter'),
                document.fonts.load('900 130px Inter'),
                document.fonts.load('600 22px Inter'),
                document.fonts.load('700 54px "PT Serif"'),
                document.fonts.load('700 126px "PT Serif"'),
                document.fonts.load('bold 126px "Century Schoolbook"')
            ]);
        } catch (e) {
            console.warn('Font loading warning:', e);
        }
    }

    // 3. Clear canvas with clean white silk base
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 4. Draw User Photo Layer (UNDER the transparent template window)
    if (userUploadedImage && userUploadedImage.width > 0 && userUploadedImage.height > 0) {
        try {
            ctx.save();
            // Translate to the photo frame center and rotate to match frame tilt
            ctx.translate(FRAME_CENTER_X, FRAME_CENTER_Y);
            ctx.rotate(FRAME_ROTATION_RAD);

            const imgRatio = userUploadedImage.width / userUploadedImage.height;
            const frameRatio = FRAME_WINDOW_WIDTH / FRAME_WINDOW_HEIGHT;

            let baseW, baseH;
            if (imgRatio > frameRatio) {
                baseH = FRAME_WINDOW_HEIGHT + 80;
                baseW = baseH * imgRatio;
            } else {
                baseW = FRAME_WINDOW_WIDTH + 80;
                baseH = baseW / imgRatio;
            }

            const finalW = baseW * photoState.zoom;
            const finalH = baseH * photoState.zoom;
            const posX = -finalW / 2 + photoState.panX;
            const posY = -finalH / 2 + photoState.panY;

            ctx.drawImage(userUploadedImage, posX, posY, finalW, finalH);
            ctx.restore();
        } catch (photoErr) {
            console.warn('Error drawing donor photo:', photoErr);
            ctx.restore();
        }
    } else {
        // Subtle placeholder guide inside the photo frame if no photo uploaded yet
        ctx.save();
        ctx.translate(FRAME_CENTER_X, FRAME_CENTER_Y);
        ctx.rotate(FRAME_ROTATION_RAD);
        ctx.fillStyle = '#F3F4F6';
        ctx.fillRect(-FRAME_WINDOW_WIDTH / 2, -FRAME_WINDOW_HEIGHT / 2, FRAME_WINDOW_WIDTH, FRAME_WINDOW_HEIGHT);
        ctx.fillStyle = '#9CA3AF';
        ctx.textAlign = 'center';
        ctx.font = '600 28px Inter, system-ui, sans-serif';
        ctx.fillText('📷 Upload Donor Photo', 0, -20);
        ctx.font = '500 18px Inter, system-ui, sans-serif';
        ctx.fillText('Fits automatically behind the frame', 0, 20);
        ctx.restore();
    }

    // 5. Draw Template Image (Overlay with 3D droplet, gold medal, border, logo)
    if (templateImage) {
        ctx.drawImage(templateImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 6. Draw Dynamic Text Layers
    const donorName = (data.donorName || 'Hero Donor').trim();
    const honorific = (data.honorific !== undefined ? data.honorific : 'Mr.').trim();
    const fullNameWithHonor = honorific ? `${honorific} ${donorName}` : donorName;
    const pronoun = getPronouns(honorific);

    const rawMilestone = data.milestoneNumber ?? data.milestone ?? 1;
    const milestoneNum = parseInt(rawMilestone, 10) || 1;
    const milestoneSuffix = getOrdinalSuffix(milestoneNum);

    const isVoluntary = data.donationType === 'voluntary' || (!data.patientName || data.patientName.trim() === '');
    const patientName = (data.patientName || '').trim();
    const hospitalName = (data.hospitalName || data.hospital || 'LifeSavers United Blood Drive').trim();
    
    // Format date nicely (e.g. "3 September 2026")
    let donationDateStr = data.donationDateStr || '';
    if (!donationDateStr && data.donationDate) {
        try {
            const parts = String(data.donationDate).split('-');
            if (parts.length === 3) {
                const year = parts[0];
                const monthIdx = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const months = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
                    donationDateStr = `${day} ${months[monthIdx]} ${year}`;
                }
            } else {
                const d = new Date(data.donationDate);
                if (!isNaN(d.getTime())) {
                    donationDateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                } else {
                    donationDateStr = String(data.donationDate);
                }
            }
        } catch (e) {
            donationDateStr = String(data.donationDate);
        }
    }
    if (!donationDateStr) donationDateStr = 'Recent Date';

    // 6A. Top Appreciation Greeting
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#374151';
    ctx.font = '500 22px Inter, system-ui, sans-serif';
    ctx.fillText('We sincerely appreciate', 65, 205);

    // Donor Name in Bold Crimson
    ctx.fillStyle = '#C20000';
    ctx.font = '800 46px Inter, system-ui, sans-serif';
    ctx.fillText(fullNameWithHonor, 65, 255);

    // Appreciation line with pronoun
    ctx.fillStyle = '#374151';
    ctx.font = '500 21px Inter, system-ui, sans-serif';
    ctx.fillText('for selflessly donating blood and', 65, 292);
    ctx.fillText(`achieving the remarkable milestone of ${pronoun.poss}`, 65, 322);

    // 6B. Gold 3D Milestone in the Main Plaque (with subtle diamond sparkles)
    drawGoldMilestone(ctx, PLAQUE_CENTER_X, PLAQUE_CENTER_Y, milestoneNum, milestoneSuffix, 126, 52, true);

    // 6C. Gold Milestone in the Round Hero Medal
    drawGoldMilestone(ctx, MEDAL_CENTER_X, MEDAL_CENTER_Y, milestoneNum, milestoneSuffix, 54, 24, false);

    // Medal sub-caption "BLOOD DONATION"
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillText('BLOOD DONATION', MEDAL_CENTER_X, MEDAL_CENTER_Y + 31);
    ctx.restore();

    // 6D. Middle Story Paragraph (With comfortable top padding from plaque)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#374151';
    ctx.font = '500 20px Inter, system-ui, sans-serif';
    ctx.fillText('Your unwavering commitment to saving lives', 65, 638);
    ctx.fillText('is a true inspiration to our community.', 65, 665);

    if (!isVoluntary && patientName) {
        ctx.fillText('This precious donation has helped', 65, 692);
        ctx.fillStyle = '#C20000';
        ctx.font = '700 20px Inter, system-ui, sans-serif';
        // Render donor's patient name directly without "Patient " prefix
        ctx.fillText(patientName, 65, 719);
        const nameWidth = ctx.measureText(patientName).width;
        ctx.fillStyle = '#374151';
        ctx.font = '500 20px Inter, system-ui, sans-serif';
        ctx.fillText(' and reflects the power', 65 + nameWidth, 719);
        ctx.fillText('of compassion, kindness, and humanity.', 65, 746);
    } else {
        ctx.fillText(`This voluntary donation at ${hospitalName}`, 65, 692);
        ctx.fillText('reflects the true power of compassion,', 65, 719);
        ctx.fillText('kindness, and selfless humanity.', 65, 746);
    }

    // 6E. Info Summary Box (Three Rows, aligned to X=152 right of icons at X=77..131)
    const infoTextX = 152;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Row 1: Donor Name
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#4B5563';
    ctx.fillText('Donor Name:', infoTextX, 804);
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#C20000';
    ctx.fillText(donorName, infoTextX, 826);

    // Row 2: Patient Name / Cause
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#4B5563';
    ctx.fillText(isVoluntary ? 'Donation Cause:' : 'Patient Name:', infoTextX, 864);
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#C20000';
    ctx.fillText(isVoluntary ? 'Voluntary / Selfless Cause' : patientName, infoTextX, 887);

    // Row 3: Donation Date
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#4B5563';
    ctx.fillText('Donation Date:', infoTextX, 923);
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#1F2937';
    ctx.fillText(donationDateStr, infoTextX, 946);

    // 6F. Sub-tagline placed neatly under the donor info summary card
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C20000';
    ctx.font = '600 13.5px Inter, system-ui, sans-serif';
    ctx.fillText('Thank you for making a difference, one donation at a time.', 275, 1007);
    ctx.restore();

    // 7. Generate Blob for download & share
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            currentRenderBlob = blob;
            resolve(blob);
        }, 'image/png', 0.98);
    });
}

/**
 * Draw 4-point diamond star sparkle
 */
function drawSparkle(ctx, cx, cy, radius, color = '#FFFDE8') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = '#FFE885';
    ctx.shadowBlur = radius * 0.8;

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.quadraticCurveTo(cx, cy, cx + radius * 0.28, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + radius);
    ctx.quadraticCurveTo(cx, cy, cx - radius * 0.28, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - radius);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + radius * 0.28);
    ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - radius * 0.28);
    ctx.quadraticCurveTo(cx, cy, cx - radius, cy);
    ctx.closePath();
    ctx.fill();

    // Central bright core
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
}

/**
 * Draw 3D Embossed Gold Milestone Number with Superscript
 * Faithfully styled to match the official Century Schoolbook gold plaque typography
 */
function drawGoldMilestone(ctx, centerX, centerY, num, suffix, mainFontSize, suffixFontSize, withSparkles = false) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numStr = String(num);
    const suffStr = String(suffix);

    // Exact matching font stack: Century Schoolbook with ball terminals on 3 and r
    const fontStack = '"Century Schoolbook", "Century Schoolbook Bold", "PT Serif", "Bookman Old Style", "Georgia", serif';
    const numFont = `bold ${mainFontSize}px ${fontStack}`;
    const suffFont = `bold ${suffixFontSize}px ${fontStack}`;

    // Measure widths to center the combined (number + suffix)
    ctx.font = numFont;
    const numWidth = ctx.measureText(numStr).width;
    ctx.font = suffFont;
    const suffWidth = ctx.measureText(suffStr).width;

    const totalWidth = numWidth + suffWidth + (mainFontSize > 80 ? 6 : 3);
    const startX = centerX - totalWidth / 2 + numWidth / 2;
    const suffixX = centerX + totalWidth / 2 - suffWidth / 2;
    const suffixY = centerY - mainFontSize * 0.24;

    // Outer Bevel Gold Gradient
    const outerGold = ctx.createLinearGradient(centerX, centerY - mainFontSize / 2, centerX, centerY + mainFontSize / 2);
    outerGold.addColorStop(0.00, '#FFF5C2');
    outerGold.addColorStop(0.20, '#F5CB5C');
    outerGold.addColorStop(0.50, '#C98B18');
    outerGold.addColorStop(0.80, '#8A5408');
    outerGold.addColorStop(1.00, '#5A3102');

    // Inner Face Gold Gradient
    const faceGold = ctx.createLinearGradient(centerX, centerY - mainFontSize / 2, centerX, centerY + mainFontSize / 2);
    faceGold.addColorStop(0.00, '#FFFDEB');
    faceGold.addColorStop(0.18, '#FDE37E');
    faceGold.addColorStop(0.42, '#E2B134');
    faceGold.addColorStop(0.70, '#B77C12');
    faceGold.addColorStop(0.92, '#7C4803');
    faceGold.addColorStop(1.00, '#4E2900');

    // 1. Deep realistic 3D drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
    ctx.shadowBlur = Math.max(6, mainFontSize * 0.09);
    ctx.shadowOffsetX = Math.max(3, mainFontSize * 0.035);
    ctx.shadowOffsetY = Math.max(5, mainFontSize * 0.055);

    // Thick dark base stroke that creates the shadow silhouette
    ctx.strokeStyle = '#241001';
    ctx.lineWidth = Math.max(5, mainFontSize * 0.07);
    ctx.lineJoin = 'round';
    ctx.font = numFont;
    ctx.strokeText(numStr, startX, centerY);
    ctx.font = suffFont;
    ctx.strokeText(suffStr, suffixX, suffixY);
    ctx.restore();

    // 2. Heavy Outer Gold Rim
    ctx.save();
    ctx.strokeStyle = outerGold;
    ctx.lineWidth = Math.max(4, mainFontSize * 0.06);
    ctx.lineJoin = 'round';
    ctx.font = numFont;
    ctx.strokeText(numStr, startX, centerY);
    ctx.font = suffFont;
    ctx.strokeText(suffStr, suffixX, suffixY);
    ctx.restore();

    // 3. Dark Recessed Groove / Inset Bevel (drawn just inside the gold rim)
    ctx.save();
    ctx.strokeStyle = '#361902';
    ctx.lineWidth = Math.max(2, mainFontSize * 0.026);
    ctx.lineJoin = 'round';
    ctx.font = numFont;
    ctx.strokeText(numStr, startX, centerY);
    ctx.font = suffFont;
    ctx.strokeText(suffStr, suffixX, suffixY);
    ctx.restore();

    // 4. Main Raised Face Metallic Gold Fill
    ctx.fillStyle = faceGold;
    ctx.font = numFont;
    ctx.fillText(numStr, startX, centerY);
    ctx.font = suffFont;
    ctx.fillText(suffStr, suffixX, suffixY);

    // 5. Specular highlight line along top edge
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 235, 0.55)';
    ctx.lineWidth = Math.max(1, mainFontSize * 0.012);
    ctx.lineJoin = 'round';
    ctx.font = numFont;
    ctx.strokeText(numStr, startX, centerY - 1.2);
    ctx.font = suffFont;
    ctx.strokeText(suffStr, suffixX, suffixY - 1.2);
    ctx.restore();

    // 6. Delicate 4-point diamond sparkles on key vertices (for main plaque)
    if (withSparkles && mainFontSize > 80) {
        // Top-left of first digit
        drawSparkle(ctx, startX - numWidth * 0.42, centerY - mainFontSize * 0.38, 14);
        // Top curve of zero or center
        drawSparkle(ctx, startX, centerY - mainFontSize * 0.44, 12);
        // Top curve of third digit
        drawSparkle(ctx, startX + numWidth * 0.36, centerY - mainFontSize * 0.36, 15);
        // Bottom curve of third digit
        drawSparkle(ctx, startX + numWidth * 0.40, centerY + mainFontSize * 0.38, 11);
        // On suffix
        drawSparkle(ctx, suffixX + suffWidth * 0.32, suffixY - suffixFontSize * 0.35, 10);
    }

    ctx.restore();
}

/**
 * Update photo transform (zoom, pan)
 */
export function updatePhotoTransform(zoom, panX, panY) {
    if (typeof zoom === 'number') photoState.zoom = Math.max(0.5, Math.min(3.0, zoom));
    if (typeof panX === 'number') photoState.panX = panX;
    if (typeof panY === 'number') photoState.panY = panY;
}

/**
 * Set user uploaded image. Accepts File, Blob, HTMLImageElement, or image URL string.
 */
export function setUserImage(source) {
    if (!source) {
        userUploadedImage = null;
        photoState.zoom = 1.0;
        photoState.panX = 0;
        photoState.panY = 0;
        return Promise.resolve(null);
    }

    if (source instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)) {
        userUploadedImage = source;
        photoState.zoom = 1.0;
        photoState.panX = 0;
        photoState.panY = 0;
        return Promise.resolve(source);
    }

    if (source instanceof Blob || source instanceof File) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    userUploadedImage = img;
                    photoState.zoom = 1.0;
                    photoState.panX = 0;
                    photoState.panY = 0;
                    resolve(img);
                };
                img.onerror = () => reject(new Error('Failed to decode image file'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(source);
        });
    }

    if (typeof source === 'string') {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                userUploadedImage = img;
                photoState.zoom = 1.0;
                photoState.panX = 0;
                photoState.panY = 0;
                resolve(img);
            };
            img.onerror = () => reject(new Error('Failed to load image from URL'));
            img.src = source;
        });
    }

    return Promise.reject(new Error('Unsupported image source type'));
}

/**
 * Trigger PNG download (supports either (canvas, fileName) or (donorName, milestone))
 */
export function downloadHeroCard(targetOrName, maybeFilenameOrMilestone) {
    let fileName = 'LifeSavers_Hero_Card.png';
    let targetCanvas = null;

    if (targetOrName instanceof HTMLCanvasElement) {
        targetCanvas = targetOrName;
        if (typeof maybeFilenameOrMilestone === 'string' && maybeFilenameOrMilestone.trim()) {
            fileName = maybeFilenameOrMilestone.trim();
        }
    } else {
        const donorName = targetOrName || 'Hero';
        const milestone = maybeFilenameOrMilestone || '1';
        const safeName = String(donorName).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeMilestone = String(milestone).replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `LifeSavers_Hero_${safeName}_${safeMilestone}th_Donation.png`;
    }

    const triggerBlobDownload = (blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    };

    if (targetCanvas) {
        targetCanvas.toBlob(triggerBlobDownload, 'image/png', 0.98);
    } else if (currentRenderBlob) {
        triggerBlobDownload(currentRenderBlob);
    }
}

/**
 * Share via Native Web Share API or WhatsApp (supports either (canvas, text, filename) or (donorName, milestone))
 */
export async function shareHeroCard(targetOrName, maybeTextOrMilestone, maybeFilename) {
    let textMsg = '';
    let targetCanvas = null;
    let fileName = 'LifeSavers_Hero_Card.png';

    if (targetOrName instanceof HTMLCanvasElement) {
        targetCanvas = targetOrName;
        textMsg = typeof maybeTextOrMilestone === 'string' ? maybeTextOrMilestone : '';
        if (maybeFilename) fileName = maybeFilename;
    } else {
        const donorName = targetOrName || 'Hero Donor';
        const milestone = maybeTextOrMilestone || 1;
        textMsg = `Proud to celebrate my ${milestone}${getOrdinalSuffix(milestone)} blood donation with LifeSavers United! Saving lives, one donation at a time. 🩸🎖️ Join us at https://lifesaversunited.org`;
    }

    let blobToShare = currentRenderBlob;
    if (targetCanvas && !blobToShare) {
        blobToShare = await new Promise((res) => targetCanvas.toBlob(res, 'image/png', 0.98));
    }

    if (navigator.share && blobToShare) {
        try {
            const file = new File([blobToShare], fileName, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'LifeSavers United Hero Card',
                    text: textMsg,
                    files: [file]
                });
                return { success: true, method: 'native' };
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn('Native share failed, falling back to WhatsApp:', e);
            } else {
                return { success: false, aborted: true };
            }
        }
    }

    // Fallback: Direct WhatsApp message link
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
    return { success: true, method: 'whatsapp' };
}
