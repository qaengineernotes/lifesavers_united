// Google Apps Script for Life Savers Donors - Updated with Donation Logging System
// Version: 2.0 - Partial Donation Tracking

// ============================================================================
// GET REQUEST HANDLER - Fetch Emergency Requests
// ============================================================================
function doGet(e) {
    try {
        console.log("GET request received");

        const spreadsheet = SpreadsheetApp.openById('1ZXoQBHZqrwoYaNHOf6LdQL0xkhSF0P_xeo19oI6-lkY');
        const sheet = spreadsheet.getSheetByName('Requests');

        if (!sheet) {
            throw new Error('Sheet "Requests" not found');
        }

        // Get all data from the sheet
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        // Skip header row and convert to objects
        const requests = [];
        let openCount = 0;
        let verifiedCount = 0;
        let closedCount = 0;
        let totalCount = 0;
        const verifierNamesSet = new Set(); // Collect unique verifier names

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            
            // Parse units fulfilled (default to 0 if empty)
            const unitsFulfilled = parseInt(row[16]) || 0;
            const unitsRequired = parseInt(row[4]) || 0;
            const unitsRemaining = unitsRequired - unitsFulfilled;
            
            // Keep the original text from the sheet (e.g., "2 Units", "3 Bags")
            const unitsRequiredText = row[4] || '';

            const request = {
                inquiryDate: row[1] || '',              // Column B
                patientName: row[2] || '',              // Column C
                contactNumber: row[3] || '',            // Column D
                unitsRequired: unitsRequired,           // Column E - Parsed integer
                unitsRequiredText: unitsRequiredText,   // Column E - Original text
                bloodType: row[5] || '',                // Column F - Required BG
                patientBloodType: row[6] || '',         // Column G - Patient BG
                patientAge: row[7] || '',               // Column H - Age
                hospitalName: row[8] || '',             // Column I - Hospital
                diagnosis: row[9] || '',                // Column J - Diagnosis
                status: row[10] || 'Open',              // Column K - Status
                urgency: row[11] || '',                 // Column L - Urgency Level
                hospitalAddress: row[12] || '',         // Column M - Hospital Address
                city: row[13] || '',                    // Column N - City
                contactPerson: row[14] || '',           // Column O - Contact Person
                contactEmail: row[15] || '',            // Column P - Email
                unitsFulfilled: unitsFulfilled,         // Column Q - Units Fulfilled
                fulfilledDate: row[17] || '',           // Column R - Fulfilled Date
                unitsRemaining: unitsRemaining,         // Calculated
                donors: row[18] || '',                  // Column S - Donors
                donorBG: row[19] || '',                 // Column T - Donor BG
                additionalInfo: row[20] || '',          // Column U - Additional Information
                closureReason: row[21] || '',           // Column V - Closure Reason
                verifiedBy: row[22] || ''               // Column W - Verified By
            };

            // Count all requests with valid patient names
            if (request.patientName && request.patientName.trim() !== '') {
                totalCount++;

                // Count by status
                switch (request.status) {
                    case 'Reopen':
                    case 'Open':
                        openCount++;
                        break;
                    case 'Verified':
                        verifiedCount++;
                        break;
                    case 'Closed':
                        closedCount++;
                        break;
                }

                // Collect verifier names for autocomplete
                if (request.verifiedBy && request.verifiedBy.trim() !== '') {
                    verifierNamesSet.add(request.verifiedBy.trim());
                }

                // Only include open and verified requests for display
                if (request.status === 'Open' || request.status === 'Verified' || request.status === 'Reopen') {
                    requests.push(request);
                }
            }
        }

        console.log(`Found ${requests.length} valid open/verified requests`);
        console.log(`Statistics - Total: ${totalCount}, Open: ${openCount}, Verified: ${verifiedCount}, Closed: ${closedCount}`);

        // Convert verifier names set to sorted array
        const verifierNames = Array.from(verifierNamesSet).sort();

        // Return the data with statistics
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                requests: requests,
                count: requests.length,
                statistics: {
                    total: totalCount,
                    open: openCount,
                    verified: verifiedCount,
                    closed: closedCount
                },
                verifierNames: verifierNames, // Include unique verifier names for autocomplete
                timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error in doGet:", error);

        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Failed to fetch requests',
                error: error.toString(),
                timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// POST REQUEST HANDLER - Main Router
// ============================================================================
function doPost(e) {
    try {
        console.log(`POST request received. Parameters: ${JSON.stringify(e.parameter)}`);

        const spreadsheet = SpreadsheetApp.openById('1ZXoQBHZqrwoYaNHOf6LdQL0xkhSF0P_xeo19oI6-lkY');
        const sheet = spreadsheet.getSheetByName('Requests');

        if (!sheet) {
            throw new Error('Sheet "Requests" not found');
        }

        // Route to appropriate handler based on action
        const action = e.parameter.action;

        switch (action) {
            case 'check_existing':
                return handleCheckExisting(e, sheet);
            
            case 'update_request':
                return handleUpdateRequest(e, sheet);
            
            case 'update_status':
                return handleUpdateStatus(e, sheet);
            
            case 'log_donation':
                return handleLogDonation(e, sheet, spreadsheet);
            
            case 'submit_donor_registration':
                return handleDonorRegistration(e, spreadsheet);
            
            case 'submit_emergency_donor':
                return handleEmergencyDonor(e, spreadsheet);
            
            default:
                // Default: New emergency blood request submission
                return handleNewRequest(e, sheet);
        }

    } catch (error) {
        console.error('Error in doPost:', error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// HANDLER: Check for Existing Request
// ============================================================================
function handleCheckExisting(e, sheet) {
    const patientName = e.parameter.patientName;
    const contactNumber = e.parameter.contactNumber;

    if (!patientName || !contactNumber) {
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Missing patient name or contact number'
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const existingRequest = checkExistingRequest(sheet, patientName, contactNumber);

    return ContentService
        .createTextOutput(JSON.stringify({
            success: true,
            existingRequest: existingRequest
        }))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// HANDLER: Update Request (Edit)
// ============================================================================
function handleUpdateRequest(e, sheet) {
    let data;
    
    try {
        if (e.parameter.data) {
            data = JSON.parse(e.parameter.data);
            console.log(`Parsed update request data: ${JSON.stringify(data)}`);
        } else {
            throw new Error('No data provided for update');
        }
    } catch (parseError) {
        console.error(`JSON parse error: ${parseError}`);
        throw new Error(`Failed to parse data: ${parseError.toString()}`);
    }

    return updateRequest(data, sheet);
}

// ============================================================================
// HANDLER: Update Status (Verify)
// ============================================================================
function handleUpdateStatus(e, sheet) {
    let data;

    try {
        if (e.parameter.data) {
            data = JSON.parse(e.parameter.data);
            console.log(`Parsed status update data: ${JSON.stringify(data)}`);
        } else {
            data = {
                patientName: e.parameter.patientName,
                bloodType: e.parameter.bloodType,
                status: e.parameter.status
            };
            console.log(`Used direct parameters: ${JSON.stringify(data)}`);
        }
    } catch (parseError) {
        console.error(`JSON parse error: ${parseError}`);
        throw new Error(`Failed to parse data: ${parseError.toString()}`);
    }

    return updateRequestStatus(data, sheet);
}

// ============================================================================
// HANDLER: Log Donation (NEW)
// ============================================================================
function handleLogDonation(e, sheet, spreadsheet) {
    let data;

    try {
        if (e.parameter.data) {
            data = JSON.parse(e.parameter.data);
            console.log(`Parsed donation data: ${JSON.stringify(data)}`);
        } else {
            throw new Error('No donation data provided');
        }
    } catch (parseError) {
        console.error(`JSON parse error: ${parseError}`);
        throw new Error(`Failed to parse donation data: ${parseError.toString()}`);
    }

    return logDonation(data, sheet, spreadsheet);
}

// ============================================================================
// HANDLER: Donor Registration
// ============================================================================
function handleDonorRegistration(e, spreadsheet) {
    console.log('Processing donor registration request');
    const data = JSON.parse(e.parameter.data);
    data.source = 'donor_registration';
    return saveDonorToFormResponses(data, spreadsheet);
}

// ============================================================================
// HANDLER: Emergency Donor
// ============================================================================
function handleEmergencyDonor(e, spreadsheet) {
    const data = JSON.parse(e.parameter.data);
    data.source = 'emergency_request_system';
    return saveDonorToFormResponses(data, spreadsheet);
}

// ============================================================================
// HANDLER: New Emergency Blood Request
// ============================================================================
function handleNewRequest(e, sheet) {
    const data = JSON.parse(e.parameter.data);

    // Validate required fields
    if (!data.patientName || !data.contactNumber || !data.bloodType || !data.hospitalName) {
        throw new Error("Missing required fields: patientName, contactNumber, bloodType, or hospitalName");
    }

    // Check for existing requests
    // Check for existing requests (Name OR Contact)
    const matchingRequests = findAllMatchingRequests(sheet, data.patientName, data.contactNumber);

    if (matchingRequests.length > 1) {
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Multiple requests found for this patient/contact. Please contact the admin.',
                error: 'MULTIPLE_MATCHES',
                timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (matchingRequests.length === 1) {
        const existingRequest = matchingRequests[0];
        if (existingRequest.status === 'Open' || existingRequest.status === 'Verified') {
            return ContentService
                .createTextOutput(JSON.stringify({
                    success: false,
                    message: 'A blood request for this patient is already open (Name or Contact match). Please check the existing request or contact support.',
                    error: 'DUPLICATE_ACTIVE_REQUEST',
                    existingRequest: existingRequest,
                    timestamp: new Date().toISOString()
                }))
                .setMimeType(ContentService.MimeType.JSON);
        } else if (existingRequest.status === 'Closed') {
            return reopenClosedRequest(sheet, existingRequest, data);
        }
    }

    const now = new Date();
    const inquiryDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

    // Prepare row data
    const rowData = [
        '',                             // Column A: No (auto-increment)
        inquiryDate,                    // Column B: Inquiry Date
        data.patientName || '',         // Column C: Patient Name
        data.contactNumber || '',       // Column D: Contact
        data.unitsRequired || '',       // Column E: Required Units
        data.bloodType || '',           // Column F: Required BG
        '',                             // Column G: Patient BG
        data.patientAge || '',          // Column H: Age
        data.hospitalName || '',        // Column I: Hospital
        data.diagnosis || '',           // Column J: Diagnosis
        'Open',                         // Column K: Status
        data.urgency || '',             // Column L: Urgency Level
        data.hospitalAddress || '',     // Column M: Hospital Address
        data.city || '',                // Column N: City
        data.contactPerson || '',       // Column O: Contact Person
        data.contactEmail || '',        // Column P: Email
        0,                              // Column Q: Units Fulfilled (NEW - starts at 0)
        '',                             // Column R: Fulfilled Date
        '',                             // Column S: Donors
        '',                             // Column T: Donor BG
        data.additionalInfo || '',      // Column U: Additional Information
        '',                             // Column V: Closure Reason
        data.verifiedBy || '',          // Column W: Verified By
    ];

    sheet.appendRow(rowData);

    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Data submitted successfully'
    })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// FUNCTION: Log Donation (Core Logic)
// ============================================================================
function logDonation(data, sheet, spreadsheet) {
    try {
        console.log(`Logging donation: ${JSON.stringify(data)}`);

        const patientName = data.patientName;
        const bloodType = data.bloodType;
        const unitsDonated = parseInt(data.unitsDonated) || 0;
        const donorType = data.donorType; // 'relative', 'donor', 'other'
        const donorName = data.donorName || '';
        const donorContact = data.donorContact || '';
        const closureReason = data.closureReason || ''; // For "Other" type

        // Validate
        if (!patientName || !bloodType) {
            throw new Error('Missing patient name or blood type');
        }

        if (unitsDonated <= 0 && donorType === 'donor') {
            throw new Error('Units donated must be greater than 0');
        }

        // Find the request row
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        let rowIndex = null;

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const rowPatientName = String(row[2] || '').trim();
            const rowBloodType = String(row[5] || '').trim();

            if (rowPatientName === patientName.trim() && rowBloodType === bloodType.trim()) {
                rowIndex = i + 1;
                break;
            }
        }

        if (!rowIndex) {
            throw new Error(`Request not found for patient: ${patientName}, blood type: ${bloodType}`);
        }

        // Get current values
        const currentRow = values[rowIndex - 1];
        const unitsRequired = parseInt(currentRow[4]) || 0;
        const currentUnitsFulfilled = parseInt(currentRow[16]) || 0;
        const currentDonors = currentRow[18] || '';

        // Calculate new units fulfilled
        const newUnitsFulfilled = currentUnitsFulfilled + unitsDonated;

        // Check for over-donation
        if (newUnitsFulfilled > unitsRequired) {
            throw new Error(`Cannot donate ${unitsDonated} units. Only ${unitsRequired - currentUnitsFulfilled} units remaining.`);
        }

        // Prepare donor info string
        let donorInfo = '';
        if (donorType === 'relative') {
            donorInfo = 'Relative';
        } else if (donorType === 'donor') {
            if (!donorName || donorName.trim() === '') {
                throw new Error('Donor name is required when donor type is "Donor"');
            }
            donorInfo = donorContact ? `${donorName}, ${donorContact}` : donorName;
        } else if (donorType === 'other') {
            donorInfo = closureReason ? `Other - ${closureReason}` : 'Other - No donation';
        }

        // Update donors list
        let updatedDonors = '';
        if (currentDonors && currentDonors.toString().trim() !== '') {
            updatedDonors = currentDonors + ' | ' + `${donorInfo} (${unitsDonated} unit${unitsDonated > 1 ? 's' : ''})`;
        } else {
            updatedDonors = `${donorInfo} (${unitsDonated} unit${unitsDonated > 1 ? 's' : ''})`;
        }

        // Update the sheet
        sheet.getRange(rowIndex, 17).setValue(newUnitsFulfilled); // Column Q: Units Fulfilled
        sheet.getRange(rowIndex, 19).setValue(updatedDonors);     // Column S: Donors

        // Log to Donation Log sheet ONLY if donor type is 'donor'
        // Do NOT log for 'relative' or 'other' types
        if (donorType === 'donor') {
            logToDonationSheet(spreadsheet, {
                patientName: patientName,
                bloodType: bloodType,
                unitsDonated: unitsDonated,
                donorType: donorType,
                donorName: donorName,
                donorContact: donorContact,
                closureReason: closureReason
            });
        }

        // Check if request should be auto-closed
        let shouldClose = false;
        let newStatus = currentRow[10]; // Keep current status

        if (newUnitsFulfilled >= unitsRequired) {
            // Auto-close the request
            shouldClose = true;
            newStatus = 'Closed';
            const fulfilledDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
            sheet.getRange(rowIndex, 11).setValue('Closed');           // Column K: Status
            sheet.getRange(rowIndex, 18).setValue(fulfilledDate);      // Column R: Fulfilled Date
        } else if (donorType === 'other' || donorType === 'relative') {
            // Close without fulfilling all units (patient died, discharged, or relative arranged)
            shouldClose = true;
            newStatus = 'Closed';
            const fulfilledDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
            sheet.getRange(rowIndex, 11).setValue('Closed');           // Column K: Status
            sheet.getRange(rowIndex, 18).setValue(fulfilledDate);      // Column R: Fulfilled Date
        }

        // Save donor to Donors sheet if donor type is "donor"
        if (donorType === 'donor' && donorName && donorName.trim() !== '') {
            const donationTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
            saveDonorToFormResponses({
                fullName: donorName,
                contactNumber: donorContact,
                bloodGroup: bloodType,
                lastDonation: donationTimestamp,
                source: 'emergency_donation_log'
            }, spreadsheet);
        }

        console.log(`Donation logged successfully. Units fulfilled: ${newUnitsFulfilled}/${unitsRequired}. Auto-closed: ${shouldClose}`);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: shouldClose 
                ? 'Donation logged and request closed successfully!' 
                : `Donation logged successfully! ${unitsRequired - newUnitsFulfilled} unit(s) remaining.`,
            unitsFulfilled: newUnitsFulfilled,
            unitsRequired: unitsRequired,
            unitsRemaining: unitsRequired - newUnitsFulfilled,
            autoClosed: shouldClose,
            newStatus: newStatus
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error in logDonation: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// FUNCTION: Log to Donation Log Sheet
// ============================================================================
function logToDonationSheet(spreadsheet, donationData) {
    try {
        let donationLogSheet = spreadsheet.getSheetByName('Donation Log');
        
        // Create sheet if it doesn't exist
        if (!donationLogSheet) {
            donationLogSheet = spreadsheet.insertSheet('Donation Log');
            // Add headers
            donationLogSheet.appendRow([
                'Timestamp',
                'Patient Name',
                'Blood Type',
                'Units Donated',
                'Donor Type',
                'Donor Name',
                'Donor Contact',
                'Closure Reason'
            ]);
        }

        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

        donationLogSheet.appendRow([
            timestamp,
            donationData.patientName,
            donationData.bloodType,
            donationData.unitsDonated,
            donationData.donorType,
            donationData.donorName || '',
            donationData.donorContact || '',
            donationData.closureReason || ''
        ]);

        console.log('Donation logged to Donation Log sheet');
    } catch (error) {
        console.error(`Error logging to Donation Log sheet: ${error}`);
        // Don't throw error - this is supplementary logging
    }
}

// ============================================================================
// FUNCTION: Update Request Status (Verify)
// ============================================================================
function updateRequestStatus(data, sheet) {
    try {
        console.log(`Updating status: ${JSON.stringify(data)}`);

        const patientName = data.patientName;
        const bloodType = data.bloodType;
        const newStatus = data.status;
        const verifiedBy = data.verifiedBy || ''; // Get verifier name

        if (!patientName || !bloodType || !newStatus) {
            throw new Error(`Missing required fields - Patient: ${patientName}, Blood Type: ${bloodType}, Status: ${newStatus}`);
        }

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const rowPatientName = String(row[2] || '').trim();
            const rowBloodType = String(row[5] || '').trim();

            if (rowPatientName === patientName.trim() && rowBloodType === bloodType.trim()) {
                sheet.getRange(i + 1, 11).setValue(newStatus); // Column K: Status

                // If status is Verified, update verifiedBy field
                if (newStatus === 'Verified' && verifiedBy) {
                    sheet.getRange(i + 1, 23).setValue(verifiedBy); // Column W: Verified By
                    console.log(`Verified by ${verifiedBy} at row ${i + 1}`);
                }

                // If status is Closed, update fulfilled date
                if (newStatus === 'Closed') {
                    const fulfilledDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
                    sheet.getRange(i + 1, 18).setValue(fulfilledDate); // Column R: Fulfilled Date
                }

                console.log(`Status updated to ${newStatus} at row ${i + 1}`);

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    message: `Status updated to ${newStatus} successfully`
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        throw new Error(`Request not found for patient: ${patientName}, blood type: ${bloodType}`);

    } catch (error) {
        console.error(`Error in updateRequestStatus: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// FUNCTION: Update Request (Edit)
// ============================================================================
function updateRequest(data, sheet) {
    try {
        const rawLookup = (data.originalContactNumber && String(data.originalContactNumber).trim() !== '')
            ? data.originalContactNumber
            : data.contactNumber;

        const normPhone = s => String(s || '').replace(/\D/g, '');
        const lookupPhone = normPhone(rawLookup);

        if (!lookupPhone) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'Missing contact number for lookup'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        let rowIndex = null;

        for (let i = 1; i < values.length; i++) {
            const rowPhone = normPhone(values[i][3]);
            if (rowPhone && rowPhone === lookupPhone) {
                rowIndex = i + 1;
                break;
            }
        }

        if (!rowIndex) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'Request not found'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Update fields
        sheet.getRange(rowIndex, 3).setValue(data.patientName || '');
        sheet.getRange(rowIndex, 4).setValue(data.contactNumber || '');
        sheet.getRange(rowIndex, 5).setValue(data.unitsRequired || '');
        sheet.getRange(rowIndex, 6).setValue(data.bloodType || '');
        sheet.getRange(rowIndex, 8).setValue(data.patientAge || '');
        sheet.getRange(rowIndex, 9).setValue(data.hospitalName || '');
        sheet.getRange(rowIndex, 10).setValue(data.diagnosis || '');
        sheet.getRange(rowIndex, 12).setValue(data.urgency || '');
        sheet.getRange(rowIndex, 13).setValue(data.hospitalAddress || '');
        sheet.getRange(rowIndex, 14).setValue(data.city || '');
        sheet.getRange(rowIndex, 15).setValue(data.contactPerson || '');
        sheet.getRange(rowIndex, 16).setValue(data.contactEmail || '');
        sheet.getRange(rowIndex, 21).setValue(data.additionalInfo || '');

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Request updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error in updateRequest: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// FUNCTION: Find All Matching Requests (Name OR Contact)
// ============================================================================
function findAllMatchingRequests(sheet, patientName, contactNumber) {
    try {
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        const matches = [];

        // Normalize inputs
        const targetName = (patientName || '').toLowerCase().trim();
        const targetContact = (contactNumber || '').toString().replace(/\D/g, ''); // Digits only

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const existingPatientName = (row[2] || '').toLowerCase().trim();
            const existingContactNumberRaw = (row[3] || '').toString();
            const existingContactNumber = existingContactNumberRaw.replace(/\D/g, '');

            // Check match: Name OR Contact
            // Only check if target values are not empty
            const nameMatch = targetName && existingPatientName === targetName;
            const contactMatch = targetContact && existingContactNumber === targetContact;

            if (nameMatch || contactMatch) {
                matches.push({
                    rowIndex: i + 1,
                    inquiryDate: row[1] || '',
                    patientName: row[2] || '',
                    contactNumber: row[3] || '',
                    unitsRequired: row[4] || '',
                    bloodType: row[5] || '',
                    patientBloodType: row[6] || '',
                    patientAge: row[7] || '',
                    hospitalName: row[8] || '',
                    diagnosis: row[9] || '',
                    status: row[10] || 'Open',
                    urgency: row[11] || '',
                    hospitalAddress: row[12] || '',
                    city: row[13] || '',
                    contactPerson: row[14] || '',
                    contactEmail: row[15] || '',
                    unitsFulfilled: row[16] || '',
                    fulfilledDate: row[17] || '',
                    donors: row[18] || '',
                    donorBloodType: row[19] || '',
                    additionalInfo: row[20] || '',
                    closureReason: row[21] || '',
                    verifiedBy: row[22] || ''
                });
            }
        }

        return matches;

    } catch (error) {
        console.error(`Error in findAllMatchingRequests: ${error}`);
        throw error;
    }
}

// ============================================================================
// FUNCTION: Check for Existing Request
// ============================================================================
function checkExistingRequest(sheet, patientName, contactNumber) {
    try {
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const existingPatientName = row[2] || '';
            const existingContactNumber = row[3] || '';

            if (existingPatientName.toLowerCase().trim() === patientName.toLowerCase().trim() &&
                existingContactNumber.toString().trim() === contactNumber.toString().trim()) {

                return {
                    rowIndex: i + 1,
                    inquiryDate: row[1] || '',
                    patientName: existingPatientName,
                    contactNumber: existingContactNumber,
                    unitsRequired: row[4] || '',
                    bloodType: row[5] || '',
                    patientBloodType: row[6] || '',
                    patientAge: row[7] || '',
                    hospitalName: row[8] || '',
                    diagnosis: row[9] || '',
                    status: row[10] || 'Open',
                    urgency: row[11] || '',
                    hospitalAddress: row[12] || '',
                    city: row[13] || '',
                    contactPerson: row[14] || '',
                    contactEmail: row[15] || '',
                    unitsFulfilled: row[16] || '',
                    fulfilledDate: row[17] || '',
                    donors: row[18] || '',
                    donorBG: row[19] || '',
                    additionalInfo: row[20] || ''
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error checking existing request:", error);
        return null;
    }
}

// ============================================================================
// FUNCTION: Reopen Closed Request
// ============================================================================
function reopenClosedRequest(sheet, existingRequest, newData) {
    try {
        const now = new Date();
        const inquiryDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
        const rowIndex = existingRequest.rowIndex;

        sheet.getRange(rowIndex, 2).setValue(inquiryDate);
        sheet.getRange(rowIndex, 5).setValue(newData.unitsRequired || '');
        sheet.getRange(rowIndex, 6).setValue(newData.bloodType);
        sheet.getRange(rowIndex, 8).setValue(newData.patientAge || '');
        sheet.getRange(rowIndex, 9).setValue(newData.hospitalName);
        sheet.getRange(rowIndex, 10).setValue(newData.diagnosis || '');
        sheet.getRange(rowIndex, 11).setValue('Reopen');
        sheet.getRange(rowIndex, 12).setValue(newData.urgency || '');
        sheet.getRange(rowIndex, 13).setValue(newData.hospitalAddress || '');
        sheet.getRange(rowIndex, 14).setValue(newData.city || '');
        sheet.getRange(rowIndex, 15).setValue(newData.contactPerson || '');
        sheet.getRange(rowIndex, 16).setValue(newData.contactEmail || '');
        sheet.getRange(rowIndex, 17).setValue(0); // Reset units fulfilled
        sheet.getRange(rowIndex, 18).setValue(''); // Reset fulfilled date
        sheet.getRange(rowIndex, 21).setValue(newData.additionalInfo || '');

        console.log("Successfully reopened request at row:", rowIndex);

        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                message: 'Previous blood request reopened successfully with updated information',
                action: 'REOPENED',
                submittedAt: now.toISOString(),
                patientName: newData.patientName
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error reopening request:", error);
        throw new Error("Failed to reopen existing request: " + error.toString());
    }
}

// ============================================================================
// FUNCTION: Save Donor to Donors Sheet
// ============================================================================
function saveDonorToFormResponses(data, spreadsheet) {
    try {
        const formResponsesSheet = spreadsheet.getSheetByName('Donors');

        if (!formResponsesSheet) {
            throw new Error('Sheet "Donors" not found');
        }

        const now = new Date();
        const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

        const duplicateInfo = checkDuplicateDonor(formResponsesSheet, data.fullName, data.contactNumber);

        if (duplicateInfo.isDuplicate) {
            console.log(`Duplicate donor found. Updating existing record.`);
            return updateExistingDonor(formResponsesSheet, duplicateInfo.rowIndex, data, timestamp);
        }

        let rowData = [];

        if (data.source === 'donor_registration') {
            let age = '';
            if (data.dateOfBirth) {
                const birthDate = new Date(data.dateOfBirth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            rowData = [
                '', timestamp, data.fullName || '', data.contactNumber || '',
                data.bloodGroup || '', data.area || '', data.emergencyAvailable || '',
                data.dateOfBirth || '', data.gender || '', data.preferredContact || '',
                age, data.weight || '', data.lastDonation || '', data.medicalHistory || '',
                data.email || '', data.city || ''
            ];
        } else if (data.source === 'emergency_donation_log') {
            // For emergency donation log, save basic info with blood group and last donation
            rowData = [
                '', timestamp, data.fullName || '', data.contactNumber || '',
                data.bloodGroup || '', '', '', '', '', '', '', '', data.lastDonation || '', '', '', ''
            ];
        } else {
            rowData = [
                '', timestamp, data.fullName || '', data.contactNumber || '',
                '', '', '', '', '', '', '', '', '', '', '', ''
            ];
        }

        formResponsesSheet.appendRow(rowData);
        console.log(`Donor details saved to Donors sheet`);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Donor details saved successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error in saveDonorToFormResponses: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ============================================================================
// FUNCTION: Check for Duplicate Donor
// ============================================================================
function checkDuplicateDonor(formResponsesSheet, donorName, contactNumber) {
    try {
        const dataRange = formResponsesSheet.getDataRange();
        const values = dataRange.getValues();

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const existingDonorName = row[2] || '';
            const existingContactNumber = row[3] || '';

            if (existingDonorName.toLowerCase().trim() === donorName.toLowerCase().trim() &&
                existingContactNumber.toString().trim() === contactNumber.toString().trim()) {

                return { isDuplicate: true, rowIndex: i + 1 };
            }
        }

        return { isDuplicate: false, rowIndex: null };
    } catch (error) {
        console.error("Error checking duplicate donor:", error);
        return { isDuplicate: false, rowIndex: null };
    }
}

// ============================================================================
// FUNCTION: Update Existing Donor
// ============================================================================
function updateExistingDonor(formResponsesSheet, rowIndex, data, timestamp) {
    try {
        const currentRow = formResponsesSheet.getRange(rowIndex, 1, 1, 16).getValues()[0];

        formResponsesSheet.getRange(rowIndex, 2).setValue(timestamp);

        if (data.source === 'donor_registration') {
            let age = currentRow[10] || '';
            if (data.dateOfBirth && data.dateOfBirth.trim() !== '') {
                const birthDate = new Date(data.dateOfBirth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            formResponsesSheet.getRange(rowIndex, 3).setValue((data.fullName && data.fullName.trim() !== '') ? data.fullName : currentRow[2]);
            formResponsesSheet.getRange(rowIndex, 4).setValue((data.contactNumber && data.contactNumber.trim() !== '') ? data.contactNumber : currentRow[3]);
            formResponsesSheet.getRange(rowIndex, 5).setValue((data.bloodGroup && data.bloodGroup.trim() !== '') ? data.bloodGroup : currentRow[4]);
            formResponsesSheet.getRange(rowIndex, 6).setValue((data.area && data.area.trim() !== '') ? data.area : currentRow[5]);
            formResponsesSheet.getRange(rowIndex, 7).setValue((data.emergencyAvailable && data.emergencyAvailable.trim() !== '') ? data.emergencyAvailable : currentRow[6]);
            formResponsesSheet.getRange(rowIndex, 8).setValue((data.dateOfBirth && data.dateOfBirth.trim() !== '') ? data.dateOfBirth : currentRow[7]);
            formResponsesSheet.getRange(rowIndex, 9).setValue((data.gender && data.gender.trim() !== '') ? data.gender : currentRow[8]);
            formResponsesSheet.getRange(rowIndex, 10).setValue((data.preferredContact && data.preferredContact.trim() !== '') ? data.preferredContact : currentRow[9]);
            formResponsesSheet.getRange(rowIndex, 11).setValue(age);
            formResponsesSheet.getRange(rowIndex, 12).setValue((data.weight && data.weight.trim() !== '') ? data.weight : currentRow[11]);
            formResponsesSheet.getRange(rowIndex, 13).setValue((data.lastDonation && data.lastDonation.trim() !== '') ? data.lastDonation : currentRow[12]);
            formResponsesSheet.getRange(rowIndex, 14).setValue((data.medicalHistory && data.medicalHistory.trim() !== '') ? data.medicalHistory : currentRow[13]);
            formResponsesSheet.getRange(rowIndex, 15).setValue((data.email && data.email.trim() !== '') ? data.email : currentRow[14]);
            formResponsesSheet.getRange(rowIndex, 16).setValue((data.city && data.city.trim() !== '') ? data.city : currentRow[15]);
        } else if (data.source === 'emergency_donation_log') {
            // For emergency donation log, update basic info and last donation date
            formResponsesSheet.getRange(rowIndex, 3).setValue((data.fullName && data.fullName.trim() !== '') ? data.fullName : currentRow[2]);
            formResponsesSheet.getRange(rowIndex, 4).setValue((data.contactNumber && data.contactNumber.trim() !== '') ? data.contactNumber : currentRow[3]);
            formResponsesSheet.getRange(rowIndex, 5).setValue((data.bloodGroup && data.bloodGroup.trim() !== '') ? data.bloodGroup : currentRow[4]);
            formResponsesSheet.getRange(rowIndex, 13).setValue(data.lastDonation || timestamp); // Update last donation
        } else {
            formResponsesSheet.getRange(rowIndex, 3).setValue((data.fullName && data.fullName.trim() !== '') ? data.fullName : currentRow[2]);
            formResponsesSheet.getRange(rowIndex, 4).setValue((data.contactNumber && data.contactNumber.trim() !== '') ? data.contactNumber : currentRow[3]);
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Donor details updated successfully',
            action: 'updated',
            rowIndex: rowIndex
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error updating existing donor: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
