// Google Apps Script for LifeSavers United - Fixed Version

// Handle GET requests (fetch requests)
// Google Apps Script for LifeSavers United - Updated Version with Statistics

// Handle GET requests (fetch requests)
function doGet(e) {
    try {
        console.log("GET request received");

        // Get the active spreadsheet
        const spreadsheet = SpreadsheetApp.openById('11cqy_pzPzoZ3wLlu-ZAT_lhnCRqbvu5Mfz5Z-UPBjGg');
        const sheet = spreadsheet.getActiveSheet();

        // Get all data from the sheet
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        // Skip header row and convert to objects
        const requests = [];
        let openCount = 0;
        let verifiedCount = 0;
        let closedCount = 0;
        let totalCount = 0;

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const request = {
                inquiryDate: row[1] || '', // Column B
                patientName: row[2] || '', // Column C
                contactNumber: row[3] || '', // Column D
                unitsRequired: row[4] || '', // Column E
                bloodType: row[5] || '', // Column F - Required BG
                patientBloodType: row[6] || '', // Column G - Patient BG
                patientAge: row[7] || '', // Column H - Age
                hospitalName: row[8] || '', // Column I - Hospital
                diagnosis: row[9] || '', // Column J - Diagnosis
                status: row[10] || 'Open', // Column K - Status
                urgency: row[11] || '', // Column L - Urgency Level
                hospitalAddress: row[12] || '', // Column M - Hospital Address
                city: row[13] || '', // Column N - City
                contactPerson: row[14] || '', // Column O - Contact Person
                contactEmail: row[15] || '', // Column P - Email
                fulfilledDate: row[16] || '', // Column Q - Fulfilled Date
                unitsFulfilled: row[17] || '', // Column R - Units Fulfilled
                donors: row[18] || '', // Column S - Donors
                donorBG: row[19] || '', // Column T - Donor BG
                additionalInfo: row[20] || '' // Column U - Additional Information
            };

            // Count all requests with valid patient names
            if (request.patientName && request.patientName.trim() !== '') {
                totalCount++;

                // Count by status
                switch (request.status) {
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

                // Only include open and verified requests for display (as before)
                if ((request.status === 'Open' || request.status === "Verified")) {
                    requests.push(request);
                }
            }
        }

        console.log(`Found ${requests.length} valid open/verified requests`);
        console.log(`Statistics - Total: ${totalCount}, Open: ${openCount}, Verified: ${verifiedCount}, Closed: ${closedCount}`);

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

// ... rest of the existing code remains the same ...

function doPost(e) {
    try {
        console.log(`POST request received. Parameters: ${JSON.stringify(e.parameter)}`);
        console.log(`Action received: ${e.parameter.action}`);

        // Get the spreadsheet using the hardcoded ID
        const spreadsheet = SpreadsheetApp.openById('11cqy_pzPzoZ3wLlu-ZAT_lhnCRqbvu5Mfz5Z-UPBjGg');
        const sheet = spreadsheet.getActiveSheet();

        // Check if this is a check_existing request
        if (e.parameter.action === 'check_existing') {
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

        // Check if this is a status update request
        if (e.parameter.action === 'update_status') {
            let data;

            try {
                if (e.parameter.data) {
                    data = JSON.parse(e.parameter.data);
                    console.log(`Parsed data from JSON: ${JSON.stringify(data)}`);
                } else {
                    // Data might be directly in parameters
                    data = {
                        patientName: e.parameter.patientName,
                        bloodType: e.parameter.bloodType,
                        status: e.parameter.status,
                        donorInfo: e.parameter.donorInfo
                    };
                    console.log(`Used direct parameters: ${JSON.stringify(data)}`);
                }
            } catch (parseError) {
                console.error(`JSON parse error: ${parseError}`);
                console.log(`Raw data string: "${e.parameter.data}"`);
                throw new Error(`Failed to parse data: ${parseError.toString()}`);
            }

            console.log(`Status update data: ${JSON.stringify(data)}`);
            return updateRequestStatus(data, sheet);
        }

        // Check if this is a donor details save request
        if (e.parameter.action === 'save_donor_details') {
            const donorData = JSON.parse(e.parameter.data);
            return saveDonorToFormResponses(donorData, spreadsheet);
        }

        // NEW: Handle donor registration from donor_registration.html
        if (e.parameter.action === 'submit_donor_registration') {
            console.log('Processing donor registration request');
            const data = JSON.parse(e.parameter.data);
            data.source = 'donor_registration';
            return saveDonorToFormResponses(data, spreadsheet);
        }

        // NEW: Handle emergency donor from emergency_request_system.html
        if (e.parameter.action === 'submit_emergency_donor') {
            const data = JSON.parse(e.parameter.data);
            data.source = 'emergency_request_system';
            return saveDonorToFormResponses(data, spreadsheet);
        }

        // Check if this is an update request
        if (e.parameter.action === 'update') {
            const data = JSON.parse(e.parameter.data);

            // Get all data from the sheet
            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();

            // Find the row with the matching ID
            let rowIndex = -1;
            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === data.id) { // Assuming ID is in column A
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) {
                throw new Error('Request not found');
            }

            // Update the row with new data
            const rowData = [
                data.id, // Keep the original ID
                values[rowIndex][1], // Keep the original inquiry date
                data.patientName || values[rowIndex][2],
                data.contactNumber || values[rowIndex][3],
                data.unitsRequired || values[rowIndex][4],
                data.bloodType || values[rowIndex][5],
                values[rowIndex][6], // Keep original patient BG
                data.patientAge || values[rowIndex][7],
                data.hospitalName || values[rowIndex][8],
                data.diagnosis || values[rowIndex][9],
                values[rowIndex][10], // Keep original status
                data.urgency || values[rowIndex][11],
                data.hospitalAddress || values[rowIndex][12],
                data.city || values[rowIndex][13],
                data.contactPerson || values[rowIndex][14],
                data.contactEmail || values[rowIndex][15],
                values[rowIndex][16], // Keep original fulfilled date
                values[rowIndex][17], // Keep original units fulfilled
                values[rowIndex][18], // Keep original donors
                values[rowIndex][19], // Keep original donor BG
                data.additionalInfo || values[rowIndex][20] || ''
            ];

            // Update the row
            sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);

            return ContentService.createTextOutput(JSON.stringify({
                success: true,
                message: 'Request updated successfully',
                action: 'UPDATED'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // This is a new form submission (emergency blood request)
        const data = JSON.parse(e.parameter.data);

        // Validate required fields for new blood requests
        if (!data.patientName || !data.contactNumber || !data.bloodType || !data.hospitalName) {
            throw new Error("Missing required fields: patientName, contactNumber, bloodType, or hospitalName");
        }

        // Check for existing requests with same patient name and contact number
        const existingRequest = checkExistingRequest(sheet, data.patientName, data.contactNumber);

        if (existingRequest) {
            if (existingRequest.status === 'Open' || existingRequest.status === 'Verified') {
                // Return error - request already exists and is active
                return ContentService
                    .createTextOutput(JSON.stringify({
                        success: false,
                        message: 'A blood request for this patient is already open. Please check the existing request or contact support.',
                        error: 'DUPLICATE_ACTIVE_REQUEST',
                        existingRequest: existingRequest,
                        timestamp: new Date().toISOString()
                    }))
                    .setMimeType(ContentService.MimeType.JSON);
            } else if (existingRequest.status === 'Closed') {
                // Reopen the closed request
                return reopenClosedRequest(sheet, existingRequest, data);
            }
        }

        const now = new Date();
        const inquiryDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

        // Prepare row data according to your Google Sheets structure
        const rowData = [
            '', // Column A: No (auto-increment by sheets)
            inquiryDate, // Column B: Inquiry Date (23-Aug-2025 09:30 format)
            data.patientName || '', // Column C: Patient Name
            data.contactNumber || '', // Column D: Contact
            data.unitsRequired || '', // Column E: Required Units
            data.bloodType || '', // Column F: Required BG
            '', // Column G: Patient BG (empty for new requests)
            data.patientAge || '', // Column H: Age
            data.hospitalName || '', // Column I: Hospital
            data.diagnosis || '', // Column J: Diagnosis / Patient Suffering From
            'Open', // Column K: Status (defaults to "Open")
            data.urgency || '', // Column L: Urgency Level
            data.hospitalAddress || '', // Column M: Hospital Address
            data.city || '', // Column N: City
            data.contactPerson || '', // Column O: Contact Person
            data.contactEmail || '', // Column P: Email
            '', // Column Q: Fulfilled Date (empty for new requests)
            '', // Column R: Units Fulfilled (empty for new requests)
            '', // Column S: Donors (Name & Contact) (empty for new requests)
            '', // Column T: Donor BG (empty for new requests)
            data.additionalInfo || '' // Column U: Additional Information
        ];

        // Append the data to the sheet
        sheet.appendRow(rowData);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Data submitted successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error('Error in doPost:', error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Function to update request status (Verified/Closed)
function updateRequestStatus(data, sheet) {
    try {
        console.log(`Raw data received: ${JSON.stringify(data)}`);

        // Check if data exists and has required properties
        if (!data) {
            throw new Error('No data received');
        }

        const patientName = data.patientName;
        const bloodType = data.bloodType;
        const newStatus = data.status;

        console.log(`Looking for patient: "${patientName}", blood type: "${bloodType}", new status: "${newStatus}"`);

        // Validate required fields
        if (!patientName || !bloodType || !newStatus) {
            throw new Error(`Missing required fields - Patient: ${patientName}, Blood Type: ${bloodType}, Status: ${newStatus}`);
        }

        // Get header row to find correct column indices
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        const headers = values[0]; // First row contains headers

        console.log(`Headers found: ${headers.join(', ')}`);

        // Find column indices by header names
        let statusColumnIndex = -1;
        let fulfilledDateColumnIndex = -1;
        let patientNameColumnIndex = -1;
        let bloodTypeColumnIndex = -1;

        for (let j = 0; j < headers.length; j++) {
            const header = headers[j].toString().toLowerCase().trim();

            if (header.includes('status') && !header.includes('urgency')) {
                statusColumnIndex = j;
            } else if (header.includes('fulfilled date') || header.includes('fulfilled')) {
                fulfilledDateColumnIndex = j;
            } else if (header.includes('patient name') || header === 'patient') {
                patientNameColumnIndex = j;
            } else if (header.includes('required bg') || header === 'required bg') {
                bloodTypeColumnIndex = j;
            }
        }

        // Fallback to assumed positions if headers not found
        if (statusColumnIndex === -1) statusColumnIndex = 10; // Column K (0-based index)
        if (fulfilledDateColumnIndex === -1) fulfilledDateColumnIndex = 16; // Column Q (0-based index)
        if (patientNameColumnIndex === -1) patientNameColumnIndex = 2; // Column C (0-based index)
        if (bloodTypeColumnIndex === -1) bloodTypeColumnIndex = 5; // Column F (0-based index)

        console.log(`Column indices - Status: ${statusColumnIndex}, Fulfilled Date: ${fulfilledDateColumnIndex}, Patient Name: ${patientNameColumnIndex}, Blood Type: ${bloodTypeColumnIndex}`);

        // Find the row with matching patient name and blood type
        for (let i = 1; i < values.length; i++) { // Start from row 2 (skip header)
            const row = values[i];
            const rowPatientName = row[patientNameColumnIndex];
            const rowBloodType = row[bloodTypeColumnIndex];

            console.log(`Row ${i + 1}: Patient="${rowPatientName}", BloodType="${rowBloodType}"`);

            // More flexible matching - trim whitespace and handle case sensitivity
            const cleanPatientName = String(rowPatientName || '').trim();
            const cleanRowBloodType = String(rowBloodType || '').trim();
            const cleanSearchPatient = String(patientName || '').trim();
            const cleanSearchBloodType = String(bloodType || '').trim();

            if (cleanPatientName === cleanSearchPatient && cleanRowBloodType === cleanSearchBloodType) {
                console.log(`Match found at row ${i + 1}`);

                // Update the status column (convert to 1-based indexing for getRange)
                sheet.getRange(i + 1, statusColumnIndex + 1).setValue(newStatus);
                console.log(`Updated status in row ${i + 1}, column ${statusColumnIndex + 1} with: ${newStatus}`);

                // If status is being set to "Closed", update fulfilled date and donor info
                if (newStatus === 'Closed') {
                    const fulfilledDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
                    sheet.getRange(i + 1, fulfilledDateColumnIndex + 1).setValue(fulfilledDate);
                    console.log(`Updated fulfilled date in row ${i + 1}, column ${fulfilledDateColumnIndex + 1} with: ${fulfilledDate}`);

                    // Update donor information if provided (Column S)
                    if (data.donorInfo) {
                        const donorsColumnIndex = 18; // Column S (0-based index)
                        sheet.getRange(i + 1, donorsColumnIndex + 1).setValue(data.donorInfo);
                        console.log(`Updated donors column in row ${i + 1}, column ${donorsColumnIndex + 1} with: ${data.donorInfo}`);
                    }
                }

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    message: `Status updated to ${newStatus} successfully`
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        console.log(`No match found for patient: "${patientName}", blood type: "${bloodType}"`);

        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: `Request not found. Searched for patient: "${patientName}", blood type: "${bloodType}"`
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error in updateRequestStatus: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Test function to verify update logic
function testUpdateStatus() {
    try {
        // Use the hardcoded spreadsheet ID
        const spreadsheet = SpreadsheetApp.openById('11cqy_pzPzoZ3wLlu-ZAT_lhnCRqbvu5Mfz5Z-UPBjGg');
        const sheet = spreadsheet.getActiveSheet();

        // Test data - use actual values from your sheet
        const testData = {
            patientName: "Jitendrasinh Bhigubha Mahida", // Use exact name from your sheet
            bloodType: "AB+", // Use exact blood type from your sheet
            status: "Verified"
        };

        console.log("Testing with data:", JSON.stringify(testData));

        const result = updateRequestStatus(testData, sheet);
        console.log("Test result:", result.getContent());

        return "Test completed - check logs for details";
    } catch (error) {
        console.error("Test error:", error);
        return `Test failed: ${error.toString()}`;
    }
}

// Function to check for existing requests
function checkExistingRequest(sheet, patientName, contactNumber) {
    try {
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        // Skip header row and search for matching patient name and contact number
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const existingPatientName = row[2] || ''; // Column C
            const existingContactNumber = row[3] || ''; // Column D

            // Check if patient name and contact number match (case-insensitive)
            if (existingPatientName.toLowerCase().trim() === patientName.toLowerCase().trim() &&
                existingContactNumber.toString().trim() === contactNumber.toString().trim()) {

                return {
                    rowIndex: i + 1, // +1 because we skipped header
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
                    fulfilledDate: row[16] || '',
                    unitsFulfilled: row[17] || '',
                    donors: row[18] || '',
                    donorBG: row[19] || '',
                    additionalInfo: row[20] || ''
                };
            }
        }

        return null; // No existing request found
    } catch (error) {
        console.error("Error checking existing request:", error);
        return null;
    }
}

// Function to reopen a closed request
function reopenClosedRequest(sheet, existingRequest, newData) {
    try {
        const now = new Date();
        const inquiryDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

        // Update the existing row with new data and reopen status
        const rowIndex = existingRequest.rowIndex;

        // Update specific cells
        sheet.getRange(rowIndex, 2).setValue(inquiryDate); // Column B: Inquiry Date
        sheet.getRange(rowIndex, 5).setValue(newData.unitsRequired || ''); // Column E: Units Required
        sheet.getRange(rowIndex, 6).setValue(newData.bloodType); // Column F: Blood Type
        sheet.getRange(rowIndex, 8).setValue(newData.patientAge || ''); // Column H: Age
        sheet.getRange(rowIndex, 9).setValue(newData.hospitalName); // Column I: Hospital
        sheet.getRange(rowIndex, 10).setValue(newData.diagnosis || ''); // Column J: Diagnosis
        sheet.getRange(rowIndex, 11).setValue('Open'); // Column K: Status - reopen
        sheet.getRange(rowIndex, 12).setValue(newData.urgency || ''); // Column L: Urgency
        sheet.getRange(rowIndex, 13).setValue(newData.hospitalAddress || ''); // Column M: Hospital Address
        sheet.getRange(rowIndex, 14).setValue(newData.city || ''); // Column N: City
        sheet.getRange(rowIndex, 15).setValue(newData.contactPerson || ''); // Column O: Contact Person
        sheet.getRange(rowIndex, 16).setValue(newData.contactEmail || ''); // Column P: Email
        sheet.getRange(rowIndex, 17).setValue(''); // Column Q: Fulfilled Date - reset
        sheet.getRange(rowIndex, 18).setValue(''); // Column R: Units Fulfilled - reset
        sheet.getRange(rowIndex, 19).setValue(''); // Column S: Donors - reset
        sheet.getRange(rowIndex, 20).setValue(''); // Column T: Donor BG - reset
        sheet.getRange(rowIndex, 21).setValue(newData.additionalInfo || ''); // Column U: Additional Info

        console.log("Successfully reopened request at row:", rowIndex);

        // Return success response
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

// Function to save donor details to Form Responses 2 sheet
function saveDonorToFormResponses(data, spreadsheet) {
    try {
        // Get the "Form Responses 2" sheet
        const formResponsesSheet = spreadsheet.getSheetByName('Form Responses 2');

        if (!formResponsesSheet) {
            throw new Error('Sheet "Form Responses 2" not found');
        }

        const now = new Date();
        const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");

        // Check for duplicates before saving (for both emergency donors and regular registrations)
        const duplicateInfo = checkDuplicateDonor(formResponsesSheet, data.fullName, data.contactNumber);

        if (duplicateInfo.isDuplicate) {
            console.log(`Duplicate donor found - Name: "${data.fullName}", Contact: "${data.contactNumber}". Updating existing record.`);
            return updateExistingDonor(formResponsesSheet, duplicateInfo.rowIndex, data, timestamp);
        }

        // Determine the submission type and prepare appropriate row data
        let rowData = [];

        if (data.source === 'donor_registration') {
            // Full donor registration from donor_registration.html
            // Calculate age from date of birth
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

            // Column mapping for donor registration:
            // A (empty), B (Timestamp), C (Full Name), D (Contact), E (Blood Group), 
            // F (Area), G (Emergency Available), H (Date of Birth), I (Gender), 
            // J (Preferred Contact), K (Age), L (Weight), M (Last Donation), 
            // N (Medical History), O (Email), P (City)
            rowData = [
                '', // Column A - Empty
                timestamp, // Column B - Timestamp
                data.fullName || '', // Column C - Full Name
                data.contactNumber || '', // Column D - Contact Number
                data.bloodGroup || '', // Column E - Blood Group
                data.area || '', // Column F - Area
                data.emergencyAvailable || '', // Column G - Emergency Available
                data.dateOfBirth || '', // Column H - Date of Birth
                data.gender || '', // Column I - Gender
                data.preferredContact || '', // Column J - Preferred Contact
                age, // Column K - Age (calculated)
                data.weight || '', // Column L - Weight
                data.lastDonation || '', // Column M - Last Donation
                data.medicalHistory || '', // Column N - Medical History
                data.email || '', // Column O - Email
                data.city || '' // Column P - City
            ];
        } else {
            // Emergency donor submission from emergency_request_system.html
            // Column mapping for emergency donor:
            // A (empty), B (Timestamp), C (Full Name), D (Contact), E-P (empty)
            rowData = [
                '', // Column A - Empty
                timestamp, // Column B - Timestamp
                data.fullName || '', // Column C - Full Name
                data.contactNumber || '', // Column D - Contact Number
                '', '', '', '', '', '', '', '', '', '', '', '' // Columns E-P - Empty for emergency submissions
            ];
        }

        // Append the row - this will place data in correct columns
        formResponsesSheet.appendRow(rowData);

        console.log(`Donor details saved to Form Responses 2: ${JSON.stringify(rowData)}`);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Donor details saved to Form Responses 2 successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error(`Error in saveDonorToFormResponses: ${error}`);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Function to check for duplicate donors in Form Responses 2 sheet
function checkDuplicateDonor(formResponsesSheet, donorName, contactNumber) {
    try {
        const dataRange = formResponsesSheet.getDataRange();
        const values = dataRange.getValues();

        // Skip header row and search for matching donor name and contact number
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const existingDonorName = row[2] || ''; // Column C - Full Name
            const existingContactNumber = row[3] || ''; // Column D - Contact Number

            // Check if donor name and contact number match (case-insensitive)
            if (existingDonorName.toLowerCase().trim() === donorName.toLowerCase().trim() &&
                existingContactNumber.toString().trim() === contactNumber.toString().trim()) {

                console.log(`Duplicate found at row ${i + 1}: Name="${existingDonorName}", Contact="${existingContactNumber}"`);
                return {
                    isDuplicate: true,
                    rowIndex: i + 1 // Return 1-based row index for Google Sheets
                };
            }
        }

        return { isDuplicate: false, rowIndex: null }; // No duplicate found
    } catch (error) {
        console.error("Error checking duplicate donor:", error);
        return { isDuplicate: false, rowIndex: null }; // Return false on error to allow saving
    }
}

// Function to update existing donor record with latest data
function updateExistingDonor(formResponsesSheet, rowIndex, data, timestamp) {
    try {
        console.log(`Updating existing donor record at row ${rowIndex}`);

        // Get current row data to preserve existing values
        const currentRow = formResponsesSheet.getRange(rowIndex, 1, 1, 16).getValues()[0];

        // Always update timestamp
        formResponsesSheet.getRange(rowIndex, 2).setValue(timestamp); // Column B - Timestamp

        if (data.source === 'donor_registration') {
            // Full donor registration - update only fields with new data
            // Calculate age from date of birth if provided
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

            // Update only fields that have new data (preserve existing data if new data is empty)
            if (data.fullName && data.fullName.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 3).setValue(data.fullName); // Column C - Full Name
            }
            if (data.contactNumber && data.contactNumber.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 4).setValue(data.contactNumber); // Column D - Contact Number
            }
            if (data.bloodGroup && data.bloodGroup.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 5).setValue(data.bloodGroup); // Column E - Blood Group
            }
            if (data.area && data.area.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 6).setValue(data.area); // Column F - Area
            }
            if (data.emergencyAvailable && data.emergencyAvailable.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 7).setValue(data.emergencyAvailable); // Column G - Emergency Available
            }
            if (data.dateOfBirth && data.dateOfBirth.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 8).setValue(data.dateOfBirth); // Column H - Date of Birth
            }
            if (data.gender && data.gender.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 9).setValue(data.gender); // Column I - Gender
            }
            if (data.preferredContact && data.preferredContact.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 10).setValue(data.preferredContact); // Column J - Preferred Contact
            }
            if (age && age !== '') {
                formResponsesSheet.getRange(rowIndex, 11).setValue(age); // Column K - Age (calculated)
            }
            if (data.weight && data.weight.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 12).setValue(data.weight); // Column L - Weight
            }
            if (data.lastDonation && data.lastDonation.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 13).setValue(data.lastDonation); // Column M - Last Donation
            }
            if (data.medicalHistory && data.medicalHistory.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 14).setValue(data.medicalHistory); // Column N - Medical History
            }
            if (data.email && data.email.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 15).setValue(data.email); // Column O - Email
            }
            if (data.city && data.city.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 16).setValue(data.city); // Column P - City
            }

        } else {
            // Emergency donor submission - update only basic fields that have data
            if (data.fullName && data.fullName.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 3).setValue(data.fullName); // Column C - Full Name
            }
            if (data.contactNumber && data.contactNumber.trim() !== '') {
                formResponsesSheet.getRange(rowIndex, 4).setValue(data.contactNumber); // Column D - Contact Number
            }
            // Leave other columns unchanged for emergency donors
        }

        console.log(`Successfully updated donor record at row ${rowIndex} with selective field updates`);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Donor details updated successfully in Form Responses 2 (selective update)',
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