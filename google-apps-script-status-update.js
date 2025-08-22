// Google Apps Script for Life Savers Donors - Fixed Version

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
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const request = {
                inquiryDate: row[1] || '',
                patientName: row[2] || '',
                contactNumber: row[3] || '',
                unitsRequired: row[4] || '',
                bloodType: row[5] || '',
                patientBloodType: row[6] || '',
                patientAge: row[7] || '',
                hospitalName: row[8] || '',
                additionalInfo: row[9] || '',
                fulfilledDate: row[10] || '',
                status: row[11] || 'Open',
                unitsFulfilled: row[12] || '',
                donors: row[13] || '',
                donorBG: row[14] || '',
                inquiryTime: row[15] || ''
            };

            // Only include open requests that have actual patient names
            if ((request.status === 'Open' || request.status === "Verified") && request.patientName && request.patientName.trim() !== '') {
                requests.push(request);
            }
        }

        console.log(`Found ${requests.length} valid open requests`);

        // Return the data
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                requests: requests,
                count: requests.length,
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

// Handle POST requests (submit blood requests)
function doPost(e) {
    try {
        // Parse the incoming data
        let data;

        console.log("Request type:", e.postData.type);
        console.log("Raw contents:", e.postData.contents);

        if (e.postData.type === 'application/x-www-form-urlencoded') {
            // Handle form data
            const formData = e.postData.contents;

            // Parse form data
            function parseFormData(formString) {
                const params = {};
                const pairs = formString.split('&');

                for (const pair of pairs) {
                    const [key, value] = pair.split('=');
                    if (key && value) {
                        const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
                        const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
                        params[decodedKey] = decodedValue;
                    }
                }
                return params;
            }

            const params = parseFormData(formData);
            console.log("Parsed form parameters:", params);

            if (params.data) {
                data = JSON.parse(params.data);
            } else {
                throw new Error("No data parameter found in form data");
            }
        } else {
            // Handle JSON data directly
            data = JSON.parse(e.postData.contents);
        }

        console.log("Successfully parsed data:", data);

        // Validate required fields
        if (!data.patientName || !data.contactNumber || !data.bloodType || !data.hospitalName) {
            throw new Error("Missing required fields: patientName, contactNumber, bloodType, or hospitalName");
        }

        // Get the active spreadsheet
        const spreadsheet = SpreadsheetApp.openById('11cqy_pzPzoZ3wLlu-ZAT_lhnCRqbvu5Mfz5Z-UPBjGg');
        const sheet = spreadsheet.getActiveSheet();

        // Get current date and time
        const now = new Date();
        const inquiryDate = now.toLocaleDateString('en-GB');
        const inquiryTime = now.toLocaleTimeString('en-GB');

        // Prepare row data according to your Google Sheets structure
        const rowData = [
            '', // No (auto-increment by sheets)
            inquiryDate, // Inquiry Date
            data.patientName, // Patient Name
            data.contactNumber, // Contact
            data.unitsRequired || '', // Required Units
            data.bloodType, // Required BG
            data.patientBloodType || '', // Patient BG (if provided)
            data.patientAge || '', // Age (if provided)
            data.hospitalName, // Hospital
            data.additionalInfo || '', // Diagnosis / Patient Suffering From
            '', // Fulfilled Date
            'Open', // Status
            '', // Units Fulfilled
            '', // Donors (Name & Contact)
            '', // Donor BG
            inquiryTime // Add timestamp for better tracking
        ];

        // Append the data to the sheet
        sheet.appendRow(rowData);

        // Log successful submission
        console.log("Successfully added row:", rowData);

        // Return success response
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                message: 'Blood request submitted successfully',
                submittedAt: now.toISOString(),
                patientName: data.patientName
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error in doPost:", error);
        console.error("Error stack:", error.stack);

        // Return detailed error response
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Failed to submit blood request',
                error: error.toString(),
                errorType: error.name,
                timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Test function
function testFunction() {
    console.log("Test function executed successfully");
    return "Test completed";
}
