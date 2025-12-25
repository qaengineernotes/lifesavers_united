// Poster Generator for Blood Requests - Square Format
// Generates 1080x1080 shareable image posters for emergency blood requests

async function generatePoster(requestData) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1080;
    canvas.height = 1080;

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // HEADER - Darker gradient with shadow
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, '#C81E1E');
    grad.addColorStop(1, '#8B0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 220);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 URGENT BLOOD NEEDED 🚨', 540, 105);

    ctx.font = '30px Arial, sans-serif';
    ctx.fillText('Emergency Request', 540, 160);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // MAIN SECTION - Load and tile background pattern image
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 220, 1080, 640);

    // Try to load the medical pattern background image
    try {
        const bgPattern = new Image();
        bgPattern.src = 'imgs/medical-pattern-bg.png';
        await new Promise((resolve, reject) => {
            bgPattern.onload = resolve;
            bgPattern.onerror = reject;
            setTimeout(reject, 2000); // Timeout after 2 seconds
        });

        // Create a pattern and fill the main section
        const pattern = ctx.createPattern(bgPattern, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 220, 1080, 640);
    } catch (error) {
        // Fallback: Draw simple pattern if image fails to load

        ctx.fillStyle = 'rgba(220,38,38,0.05)';
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 4; j++) {
                const x = 80 + i * 150, y = 280 + j * 170;
                ctx.fillRect(x - 10, y - 35, 20, 70);
                ctx.fillRect(x - 35, y - 10, 70, 20);
            }
        }

        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 3; j++) {
                const x = 150 + i * 150, y = 370 + j * 170;
                ctx.beginPath();
                ctx.moveTo(x, y - 20);
                ctx.quadraticCurveTo(x - 15, y - 5, x - 15, y + 5);
                ctx.quadraticCurveTo(x - 15, y + 20, x, y + 28);
                ctx.quadraticCurveTo(x + 15, y + 20, x + 15, y + 5);
                ctx.quadraticCurveTo(x + 15, y - 5, x, y - 20);
                ctx.fill();
            }
        }
    }

    // Blood circle - Enhanced with gradient stroke and shadow
    // Stronger shadow for depth
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    // White background fill
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(540, 420, 120, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for stroke
    ctx.shadowColor = 'rgba(220,38,38,0.5)'; // Red shadow for glow effect
    ctx.shadowBlur = 25;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Gradient stroke for the circle border
    const circleGradient = ctx.createLinearGradient(540, 300, 540, 540);
    circleGradient.addColorStop(0, '#EF4444'); // Lighter red at top
    circleGradient.addColorStop(0.5, '#DC2626'); // Medium red in middle
    circleGradient.addColorStop(1, '#991B1B'); // Darker red at bottom

    ctx.strokeStyle = circleGradient;
    ctx.lineWidth = 15; // Thick stroke
    ctx.beginPath();
    ctx.arc(540, 420, 120, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Gradient fill for blood type text
    const bloodTypeGradient = ctx.createLinearGradient(540, 360, 540, 480);
    bloodTypeGradient.addColorStop(0, '#DC2626');
    bloodTypeGradient.addColorStop(1, '#B91C1C');
    ctx.fillStyle = bloodTypeGradient;
    ctx.font = 'bold 110px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(requestData.bloodType || 'B+', 540, 455);

    // Patient info - Updated styling to match preview
    ctx.fillStyle = '#000';
    ctx.font = 'bold 30px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const age = requestData.patientAge ? ` (${requestData.patientAge} years)` : '';
    ctx.fillText(`Patient: ${requestData.patientName}${age}`, 540, 600);

    // Hospital info - Updated styling (same font style as patient name)
    ctx.font = 'bold 30px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText(`🏥 ${requestData.hospitalName}, ${requestData.city || ''}`, 540, 650);

    // Badges - Updated styling to match preview (centered)
    // Use the exact units text from Excel (e.g., "1 Blood - 1 SDP" or "2")
    const units = requestData.unitsRequiredText || requestData.unitsRequired || '2';
    const urg = requestData.urgency || 'Normal';

    // Smart logic: Add "Units" only if the value is purely numeric
    // Examples: "2" -> "2 Units", "2 Units" -> "2 Units", "1 Blood - 1 SDP" -> "1 Blood - 1 SDP"
    const isOnlyNumber = /^\d+$/.test(String(units).trim());
    const unitsDisplay = isOnlyNumber ? `${units} Units` : units;

    // Calculate centered positions
    // Canvas width = 1080px
    // Units badge width = 240px, Urgency badge width = 200px
    // Gap between badges = 20px
    // Total width = 240 + 20 + 200 = 460px
    // Starting X = (1080 - 460) / 2 = 310px

    const unitsX = 310;
    const urgencyX = 310 + 240 + 20; // 570

    // Units Required Badge - Filled red background
    ctx.fillStyle = '#DC2626';
    roundRect(unitsX, 695, 240, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 22px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${unitsDisplay}`, unitsX + 120, 726); // Center text in badge - smart display with "Units" for numbers only

    // Urgency Badge - Outlined style
    let urgColor = '#F59E0B';
    if (urg.toLowerCase() === 'critical') urgColor = '#DC2626';
    if (urg.toLowerCase() === 'normal') urgColor = '#10B981';

    ctx.strokeStyle = urgColor;
    ctx.lineWidth = 3;
    roundRect(urgencyX, 695, 200, 50, 8);
    ctx.stroke();
    ctx.fillStyle = urgColor;
    ctx.font = 'bold 22px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${urg.toUpperCase()} ⚠️`, urgencyX + 100, 726); // Center text in badge

    // CONTACT SECTION - Full width background
    // Draw full-width contact section background
    ctx.fillStyle = '#e6e6e6ff'; // Darker gray background
    ctx.fillRect(0, 860, 1080, 100); // Full width section from Y=860 to Y=960

    // Phone number
    const phoneText = `📞 ${requestData.contactNumber}`;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(phoneText, 540, 900);

    // Time Posted
    const time = calculateTimeSince(requestData.inquiryDate);
    const timeText = `Time Posted: ${time} ago`;
    ctx.font = '20px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(timeText, 540, 935);

    // FOOTER
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 960, 1080, 120);

    // Logo - Centered vertically in middle of footer
    try {
        const logo = new Image();
        logo.src = 'imgs/Life-saver-united-logo.png';
        await new Promise((res, rej) => {
            logo.onload = res;
            logo.onerror = rej;
            setTimeout(rej, 2000);
        });
        const h = 60, w = (logo.width / logo.height) * h;
        const logoY = 960 + (120 - h) / 2; // Center vertically in footer
        ctx.drawImage(logo, 60, logoY, w, h);
    } catch {
        ctx.fillStyle = '#DC2626';
        ctx.font = 'bold 20px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('LifeSavers United', 60, 1020);
    }

    // Website URL - Center
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('lifesaversunited.org', 540, 1010);

    // Social media handles with icons
    try {
        const instagramIcon = new Image();
        const xIcon = new Image();
        instagramIcon.src = 'imgs/instagram-icon.png';
        xIcon.src = 'imgs/x-icon.png';

        await Promise.all([
            new Promise((res, rej) => {
                instagramIcon.onload = res;
                instagramIcon.onerror = rej;
                setTimeout(rej, 2000);
            }),
            new Promise((res, rej) => {
                xIcon.onload = res;
                xIcon.onerror = rej;
                setTimeout(rej, 2000);
            })
        ]);

        // Draw Instagram icon and handle
        const iconSize = 20;
        ctx.drawImage(instagramIcon, 280, 1025, iconSize, iconSize);
        ctx.font = '18px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText('@lifesavers_blooddonors', 310, 1040);

        // Draw X icon and handle
        ctx.drawImage(xIcon, 580, 1025, iconSize, iconSize);
        ctx.textAlign = 'left';
        ctx.fillText('@lifesavers_blooddonors', 610, 1040);

    } catch (error) {
        // Fallback to emoji if icons fail to load

        ctx.font = '18px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.fillText('📷 @lifesavers_blooddonors     🐦 @lifesavers_blooddonors', 540, 1040);
    }

    // Tagline
    ctx.font = 'italic 16px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center'; // Reset to center alignment
    ctx.fillText('Connecting Donors. Saving Lives.', 540, 1065);

    return new Promise(res => {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `blood-request-${requestData.patientName.replace(/\s+/g, '-')}.png`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
            res();
        }, 'image/png');
    });
}

function generateWhatsAppMessage(requestData) {
    return `Patient Name: ${requestData.patientName || 'N/A'}
Age: ${requestData.patientAge || 'N/A'}
Blood Group: ${requestData.bloodType || 'N/A'}
Units Required: ${requestData.unitsRequiredText || requestData.unitsRequired || 'N/A'}
Hospital: ${requestData.hospitalName || 'N/A'}
Location: ${requestData.city || 'N/A'}
Suffering From: ${requestData.diagnosis || 'N/A'}
Contact Person: ${requestData.contactPerson || 'N/A'}
Contact Number: ${requestData.contactNumber || 'N/A'}

Connect with Life Savers United - Your community blood donation network
Visit: https://lifesaversunited.org/`;
}

function calculateTimeSince(date) {
    const now = new Date();
    let d = new Date(date);

    if (isNaN(d.getTime()) && typeof date === 'string') {
        const parts = date.split(/[\/\-]/);
        if (parts.length >= 3) {
            d = new Date(parts[2], parts[1] - 1, parts[0]);
            if (isNaN(d.getTime())) d = new Date(parts[0], parts[1] - 1, parts[2]);
        }
    }

    if (isNaN(d.getTime())) return 'Unknown';

    const diff = now - d;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    if (hours < 1) return `${mins} minutes`;
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
}
