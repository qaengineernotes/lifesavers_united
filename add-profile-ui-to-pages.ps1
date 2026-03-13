# Add User Profile UI to All HTML Pages
# This script adds the user profile UI initialization code to all HTML pages

$profileUIScript = @"

     <!-- User Profile UI -->
    <script type="module">
        import('./scripts/user-profile-ui.js').then(module => {
            module.initializeUserProfileUI();
        }).catch(error => {
            console.error('Failed to load user profile UI:', error);
        });
    </script>

    <!-- Microsoft Clarity -->
    <script type="text/javascript">
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "vv2e6pv1i7");
    </script>
"@

# List of HTML files to update (excluding node_modules and already updated files)
$htmlFiles = @(
    "donor_registration.html",
    "emergency_blood_request.html",
    "blood_information_center.html",
    "about_us.html",
    "gallery.html",
    "faq.html",
    "stories.html",
    "privacy_policy.html",
    "health_assessment_tools.html",
    "medical_information_library.html"
)

$updatedCount = 0
$skippedCount = 0

foreach ($file in $htmlFiles) {
    $filePath = Join-Path $PSScriptRoot $file
    
    if (Test-Path $filePath) {
        # Read the file content
        $content = Get-Content $filePath -Raw
        
        # Check if profile UI script is already added
        if ($content -match "user-profile-ui\.js") {
            Write-Host "✓ Skipped: $file (already has profile UI)" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
        
        # Find the closing </head> tag and insert the script before it
        if ($content -match "\</head\>") {
            $newContent = $content -replace "\</head\>", "$profileUIScript`n</head>"
            
            # Write the updated content back to the file
            Set-Content -Path $filePath -Value $newContent -NoNewline
            
            Write-Host "✓ Updated: $file" -ForegroundColor Green
            $updatedCount++
        } else {
            Write-Host "✗ Error: $file (no </head> tag found)" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Not found: $file" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Updated: $updatedCount files" -ForegroundColor Green
Write-Host "  Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan
