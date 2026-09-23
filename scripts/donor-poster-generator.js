function loadImageSafely(src, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        setTimeout(() => reject(new Error(`Timed out loading ${src}`)), timeoutMs);
        img.src = src;
    });
}

export async function generateDonorPoster(name, bloodGroup) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // 1. BASE BACKGROUND - Clean White/Off-White
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. MEDICAL PATTERN OVERLAY
    try {
        const bgPattern = await loadImageSafely('imgs/medical-pattern-bg.webp', 1500);

        ctx.globalAlpha = 0.8;
        const pattern = ctx.createPattern(bgPattern, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, 1080, 1080);
        ctx.globalAlpha = 1.0;
    } catch (error) {
        console.log("Pattern not loaded");
    }

    // 3. TOP RED WAVE/HEADER
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1080, 0);
    ctx.lineTo(1080, 250);
    ctx.quadraticCurveTo(540, 380, 0, 250); // Curved bottom
    ctx.closePath();

    const topGrad = ctx.createLinearGradient(0, 0, 1080, 0);
    topGrad.addColorStop(0, '#DC2626');
    topGrad.addColorStop(1, '#991B1B');
    ctx.fillStyle = topGrad;

    // Shadow for header
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Header Text
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 60px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('PROUD TO BE A LIFESAVER', 540, 100);

    ctx.fillStyle = '#FCD34D'; // Gold
    ctx.font = '30px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('I just pledged to save lives!', 540, 160);

    // 4. THE HAPPY BLOOD CHARACTER (Far Right)
    const dropX = 880;
    const dropY = 640;
    const dropSize = 400;

    try {
        const dropImg = await loadImageSafely('imgs/Happy-Blood.webp', 1500);

        ctx.shadowColor = 'rgba(220, 38, 38, 0.2)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;

        ctx.drawImage(dropImg, dropX - dropSize / 2, dropY - dropSize / 2, dropSize, dropSize);

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    } catch (error) {
        console.log("Could not load blood drop image");
    }

    // 5. THE MASSIVE BLOOD GROUP HIGHLIGHT (Center/Right)
    const bgTextX = 600;
    const bgTextY = 580;

    ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;

    const bloodGroupGrad = ctx.createLinearGradient(bgTextX, bgTextY - 80, bgTextX, bgTextY + 80);
    bloodGroupGrad.addColorStop(0, '#EF4444');
    bloodGroupGrad.addColorStop(1, '#991B1B');

    ctx.fillStyle = bloodGroupGrad;
    ctx.font = '900 180px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bloodGroup, bgTextX, bgTextY);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.textBaseline = 'alphabetic'; // Reset

    // 6. TEXT CONTENT (Stacked vertically on the Left)
    ctx.textAlign = 'left';

    // Donor Name (Huge Dark Text)
    ctx.fillStyle = '#111827';
    ctx.font = '900 75px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(name, 80, 440);

    // Red Badge Line
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(80, 480, 150, 8);

    // --- EXTRA TEXT SECTIONS --- //

    const compatibility = {
        'A+': 'A+, AB+',
        'A-': 'A+, A-, AB+, AB-',
        'B+': 'B+, AB+',
        'B-': 'B+, B-, AB+, AB-',
        'AB+': 'AB+',
        'AB-': 'AB+, AB-',
        'O+': 'O+, A+, B+, AB+',
        'O-': 'Everyone (Universal)'
    };
    const canDonateTo = compatibility[bloodGroup] || 'Check local guidelines';

    // Label 1
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('PLEDGE / COMMITMENT', 80, 560);

    // Value 1
    ctx.fillStyle = '#111827';
    ctx.font = '28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Emergency Responder', 80, 600);

    // Label 2
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('CAN DONATE TO', 80, 680);

    // Value 2
    ctx.fillStyle = '#DC2626'; // Emphasizing with red text
    ctx.font = 'bold 28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(canDonateTo, 80, 720);

    // Impact statement
    ctx.fillStyle = '#DC2626';
    ctx.font = 'italic bold 32px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('"Every drop makes a hero."', 80, 790);

    // Call to Action statement
    ctx.fillStyle = '#4B5563'; // Dark Gray
    ctx.font = 'italic 20px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('"I’ve taken the pledge to become a lifesaver. Now it’s your turn!', 80, 830);
    ctx.fillText('I request all my friends and family to register and join the mission."', 80, 860);

    // 6. FOOTER/BRANDING (Dark Red)
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 900, 1080, 180);

    // Try to load the white logo
    try {
        const logo = await loadImageSafely('imgs/Life-saver-united-logo-white.webp', 1500);
        const h = 70;
        const w = (logo.width / logo.height) * h;

        // Create off-screen canvas to convert the entire logo (including the red icon) to pure white
        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = w;
        logoCanvas.height = h;
        const logoCtx = logoCanvas.getContext('2d');
        logoCtx.drawImage(logo, 0, 0, w, h);
        logoCtx.globalCompositeOperation = 'source-in';
        logoCtx.fillStyle = '#FFFFFF';
        logoCtx.fillRect(0, 0, w, h);

        ctx.drawImage(logoCanvas, 80, 955);
    } catch (e) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText('LifeSavers United', 80, 1000);
    }

    // Website on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('www.lifesaversunited.org', 1000, 980);

    ctx.fillStyle = '#FCA5A5';
    ctx.font = '24px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Join the mission. Register today.', 1000, 1020);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

/**
 * Generate High-Resolution Digital Donor Card for Donor Portal
 * Reuses the official registration poster visual theme with personal portal details.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.bloodGroup
 * @param {string} [params.tier]
 * @param {string} [params.donorId]
 * @param {string} [params.city]
 * @param {number} [params.totalDonations]
 * @returns {Promise<Blob>}
 */
export async function generateDonorPortalCard({
    name = 'Hero Donor',
    bloodGroup = 'O+',
    tier = 'Bronze Lifesaver',
    donorId = 'LSU-DONOR',
    city = 'Ahmedabad, Gujarat',
    totalDonations = 0
}) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // 1. BASE BACKGROUND - Clean White/Off-White
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. MEDICAL PATTERN OVERLAY
    try {
        const bgPattern = await loadImageSafely('imgs/medical-pattern-bg.webp', 1500);

        ctx.globalAlpha = 0.8;
        const pattern = ctx.createPattern(bgPattern, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, 1080, 1080);
        ctx.globalAlpha = 1.0;
    } catch (error) {
        console.log("Pattern not loaded");
    }

    // 3. TOP RED WAVE/HEADER
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1080, 0);
    ctx.lineTo(1080, 250);
    ctx.quadraticCurveTo(540, 380, 0, 250); // Curved bottom
    ctx.closePath();

    const topGrad = ctx.createLinearGradient(0, 0, 1080, 0);
    topGrad.addColorStop(0, '#DC2626');
    topGrad.addColorStop(1, '#991B1B');
    ctx.fillStyle = topGrad;

    // Shadow for header
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Header Text
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('OFFICIAL DIGITAL DONOR CARD', 540, 95);

    ctx.fillStyle = '#FCD34D'; // Gold
    ctx.font = '28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('LifeSavers United • Verified Donor Network', 540, 155);

    // 4. THE HAPPY BLOOD CHARACTER (Far Right)
    const dropX = 880;
    const dropY = 640;
    const dropSize = 400;

    try {
        const dropImg = await loadImageSafely('imgs/Happy-Blood.webp', 1500);

        ctx.shadowColor = 'rgba(220, 38, 38, 0.2)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;

        ctx.drawImage(dropImg, dropX - dropSize / 2, dropY - dropSize / 2, dropSize, dropSize);

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    } catch (error) {
        console.log("Could not load blood drop image");
    }

    // 5. THE MASSIVE BLOOD GROUP HIGHLIGHT (Center/Right)
    const bgTextX = 600;
    const bgTextY = 570;

    ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;

    const bloodGroupGrad = ctx.createLinearGradient(bgTextX, bgTextY - 80, bgTextX, bgTextY + 80);
    bloodGroupGrad.addColorStop(0, '#EF4444');
    bloodGroupGrad.addColorStop(1, '#991B1B');

    ctx.fillStyle = bloodGroupGrad;
    ctx.font = '900 170px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bloodGroup || 'O+', bgTextX, bgTextY);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.textBaseline = 'alphabetic'; // Reset

    // 6. DONOR DETAILS (Stacked vertically on the Left)
    ctx.textAlign = 'left';

    // Dynamic Font Scaling for Donor Name
    const cleanName = String(name || 'Hero Donor').trim();
    let nameFontSize = 64;
    if (cleanName.length > 22) nameFontSize = 44;
    else if (cleanName.length > 15) nameFontSize = 52;

    ctx.fillStyle = '#111827';
    ctx.font = `900 ${nameFontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillText(cleanName, 80, 415);

    // Red Accent Line
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(80, 435, 140, 6);

    // Milestone Tier Pill
    let tierBg = '#FEF3C7';
    let tierColor = '#92400E';
    let tierBorder = '#FDE68A';

    const cleanTier = String(tier || 'Bronze Lifesaver');
    if (cleanTier.toLowerCase().includes('platinum')) {
        tierBg = '#E0E7FF';
        tierColor = '#4338CA';
        tierBorder = '#C7D2FE';
    } else if (cleanTier.toLowerCase().includes('gold')) {
        tierBg = '#FEF08A';
        tierColor = '#854D0E';
        tierBorder = '#FACC15';
    } else if (cleanTier.toLowerCase().includes('silver')) {
        tierBg = '#F1F5F9';
        tierColor = '#475569';
        tierBorder = '#CBD5E1';
    }

    const tierText = cleanTier.toUpperCase();
    ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
    const textWidth = ctx.measureText(tierText).width;
    const pillWidth = Math.max(textWidth + 34, 180);
    const pillHeight = 38;
    const pillX = 80;
    const pillY = 460;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 19);
    ctx.fillStyle = tierBg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = tierBorder;
    ctx.stroke();

    ctx.fillStyle = tierColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tierText, pillX + pillWidth / 2, pillY + pillHeight / 2);
    ctx.textBaseline = 'alphabetic'; // Reset

    // Compatibility table
    const compatibility = {
        'A+': 'A+, AB+',
        'A-': 'A+, A-, AB+, AB-',
        'B+': 'B+, AB+',
        'B-': 'B+, B-, AB+, AB-',
        'AB+': 'AB+',
        'AB-': 'AB+, AB-',
        'O+': 'O+, A+, B+, AB+',
        'O-': 'Everyone (Universal)'
    };
    const canDonateTo = compatibility[bloodGroup] || 'Check local guidelines';

    ctx.textAlign = 'left';

    // Label 1: Location / Chapter
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('LOCATION / CHAPTER', 80, 560);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(city || 'Ahmedabad, Gujarat', 80, 600);

    // Label 2: Can Donate To
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('CAN DONATE TO', 80, 675);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(canDonateTo, 80, 715);

    // Impact statement
    ctx.fillStyle = '#DC2626';
    ctx.font = 'italic bold 28px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('"Every drop makes a hero."', 80, 795);

    ctx.fillStyle = '#4B5563';
    ctx.font = 'italic 19px "Segoe UI", Roboto, Arial, sans-serif';
    if (totalDonations > 0) {
        ctx.fillText(`${totalDonations} Life-Saving Donation${totalDonations > 1 ? 's' : ''} Recorded • Ready to Save Lives`, 80, 835);
    } else {
        ctx.fillText('Registered Voluntary Blood Donor — Ready to Save Lives', 80, 835);
    }

    // 7. FOOTER/BRANDING (Dark Red)
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 900, 1080, 180);

    try {
        const logo = await loadImageSafely('imgs/Life-saver-united-logo-white.webp', 1500);
        const h = 70;
        const w = (logo.width / logo.height) * h;

        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = w;
        logoCanvas.height = h;
        const logoCtx = logoCanvas.getContext('2d');
        logoCtx.drawImage(logo, 0, 0, w, h);
        logoCtx.globalCompositeOperation = 'source-in';
        logoCtx.fillStyle = '#FFFFFF';
        logoCtx.fillRect(0, 0, w, h);

        ctx.drawImage(logoCanvas, 80, 955);
    } catch (e) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText('LifeSavers United', 80, 1000);
    }

    // Website & Hotline on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('www.lifesaversunited.org', 1000, 975);

    ctx.fillStyle = '#FCA5A5';
    ctx.font = '22px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('24/7 Helpline: +91 9979260393', 1000, 1015);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

