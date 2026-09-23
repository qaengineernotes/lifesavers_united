/**
 * LifeSavers United - Certificate Generator
 * Generates official high-resolution Certificates of Appreciation on Canvas.
 */

/**
 * Generate High-Resolution Certificate of Appreciation
 *
 * @param {Object} params
 * @param {string} params.name - Donor's full name
 * @param {string} params.bloodGroup - Blood group (e.g. 'O+')
 * @param {string} params.hospital - Blood Bank, Hospital, or Camp name
 * @param {string} [params.patientName] - Patient name if donation was for a specific recipient
 * @param {Date|string} params.donationDate - Date of donation
 * @param {string} params.certificateNo - Formatted certificate ID (e.g. 'LSU-202601')
 * @returns {Promise<Blob>}
 */
export async function generateDonorCertificate({
    name = 'Hero Donor',
    bloodGroup = 'O+',
    hospital = 'Voluntary Camp / Blood Center',
    patientName = '',
    donationDate = new Date(),
    certificateNo = 'LSU-202601'
}) {
    // 2x Retina Resolution: 2048 x 1446 (matches 1024 x 723 template ratio)
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1446;
    const ctx = canvas.getContext('2d');

    // 1. Preload luxury fonts if available
    try {
        if (document.fonts) {
            await Promise.allSettled([
                document.fonts.load('800 56px Cinzel'),
                document.fonts.load('normal 100px "Alex Brush"'),
                document.fonts.load('italic 26px "Playfair Display"'),
                document.fonts.load('bold 30px "Playfair Display"')
            ]);
        }
    } catch (e) {
        console.warn('Font preloading note:', e);
    }

    // 2. Load and Draw Base Certificate Template
    const templateImg = new Image();

    await new Promise((resolve, reject) => {
        if (templateImg.complete && templateImg.naturalWidth > 0) {
            resolve();
            return;
        }
        templateImg.onload = resolve;
        templateImg.onerror = () => reject(new Error('Failed to load certificate template image'));
        setTimeout(() => reject(new Error('Certificate template image load timed out')), 6000);
        templateImg.src = 'imgs/certificate-template.png';
    });

    ctx.drawImage(templateImg, 0, 0, 2048, 1446);

    // Format readable date
    let formattedDateStr = 'Recent Date';
    try {
        const dObj = donationDate instanceof Date ? donationDate : new Date(donationDate);
        if (!isNaN(dObj.getTime())) {
            formattedDateStr = dObj.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    } catch (e) {
        formattedDateStr = String(donationDate || '');
    }

    // 3. Title: CERTIFICATE OF APPRECIATION
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#991B1B';
    ctx.font = '800 56px "Cinzel", "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('CERTIFICATE OF APPRECIATION', 1024, 400);

    // Decorative Gold Line under Title
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(780, 424);
    ctx.lineTo(1268, 424);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(1024, 424, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#D97706';
    ctx.fill();

    // 4. Sub-heading
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 26px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('Presented with Sincere Gratitude & Respect to', 1024, 468);

    // 5. Donor Name in Luxurious Cursive Writing
    const cleanName = String(name || 'Hero Donor').trim();
    let cursiveFontSize = 100;
    if (cleanName.length > 28) cursiveFontSize = 72;
    else if (cleanName.length > 20) cursiveFontSize = 84;

    ctx.fillStyle = '#881337'; // Deep Burgundy
    ctx.font = `normal ${cursiveFontSize}px "Alex Brush", "Great Vibes", "Brush Script MT", "Segoe Script", cursive, serif`;
    ctx.fillText(cleanName, 1024, 576);

    // 6. Blood Group Pill Badge
    const cleanBlood = String(bloodGroup || 'Blood Donor').trim();
    const bloodPillText = cleanBlood.includes('Group') ? cleanBlood : `Blood Group: ${cleanBlood}`;
    ctx.font = 'bold 24px "Segoe UI", Roboto, Arial, sans-serif';
    const pillTextWidth = ctx.measureText(bloodPillText).width;
    const pillW = Math.max(pillTextWidth + 48, 280);
    const pillH = 44;
    const pillX = 1024 - pillW / 2;
    const pillY = 612;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fillStyle = '#FEF2F2';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FCA5A5';
    ctx.stroke();

    ctx.fillStyle = '#991B1B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bloodPillText, 1024, pillY + pillH / 2);
    ctx.textBaseline = 'alphabetic'; // Reset

    // 7. Ribbon Banner: Honorary Lifesaver & Community Champion
    const ribbonW = 720;
    const ribbonH = 52;
    const ribbonX = 1024 - ribbonW / 2;
    const ribbonY = 688;

    ctx.beginPath();
    ctx.roundRect(ribbonX, ribbonY, ribbonW, ribbonH, 8);
    ctx.fillStyle = '#991B1B';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#D97706';
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.font = 'bold 22px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ HONORARY LIFESAVER & COMMUNITY CHAMPION ★', 1024, ribbonY + ribbonH / 2);
    ctx.textBaseline = 'alphabetic'; // Reset

    // 8. Citation Text (Personalized with Patient & Hospital)
    const cleanHospital = String(hospital || 'Voluntary Camp / Blood Center').trim();
    const safeHospital = cleanHospital.length > 45 ? cleanHospital.substring(0, 42) + '...' : cleanHospital;
    const cleanPatient = String(patientName || '').trim();
    const hasPatient = Boolean(cleanPatient && cleanPatient !== 'Direct / Voluntary Camp');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = '28px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('In grateful recognition of your selfless, life-saving voluntary blood donation', 1024, 792);

    ctx.font = 'bold 30px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#111827';
    if (hasPatient) {
        ctx.fillText(`for patient ${cleanPatient} at ${safeHospital}`, 1024, 832);
    } else {
        ctx.fillText(`conducted at ${safeHospital}`, 1024, 832);
    }

    // 9. Inspiring Appreciation Paragraph
    ctx.fillStyle = '#475569';
    ctx.font = '26px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('In sincere appreciation of your exceptional dedication, humanitarian spirit, and invaluable contribution.', 1024, 896);
    ctx.fillText('Through your voluntary gift, you have provided the precious gift of life and renewed hope to patients and families.', 1024, 932);

    // 10. Emotional Core Message
    ctx.fillStyle = '#991B1B';
    ctx.font = 'italic bold 28px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('❤️ Your generosity gives hope. • Your commitment saves lives. • You are a True LifeSaver. ❤️', 1024, 1008);

    // 11. Dedication & Motto
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 22px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('FOR OUTSTANDING VOLUNTARY SERVICE TO THE LIFESAVERS UNITED EMERGENCY NETWORK', 1024, 1080);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'italic bold 28px "Playfair Display", "Times New Roman", Georgia, serif';
    ctx.fillText('“Every Donation. Every Effort. Every Life Matters.”', 1024, 1124);

    // 12. Bottom Metadata: Certificate Number on Left, Date on Right
    ctx.textAlign = 'left';
    ctx.fillStyle = '#991B1B';
    ctx.font = 'bold 26px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(`Certificate No: ${certificateNo || 'LSU-202601'}`, 240, 1250);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '600 26px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(`Date of Donation: ${formattedDateStr}`, 1808, 1250);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}
