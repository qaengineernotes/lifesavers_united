// Add these functions to your existing Google Apps Script

// Function to update request status (Verified or Closed)
function updateRequestStatus(data) {
    try {
        console.log("Updating request status:", data);

        // Validate required fields
        if (!data.patientName || !data.bloodType || !data.status) {
            throw new Error("Missing required fields: patientName, bloodType, or status");
        }

        // Get the active spreadsheet
        const spreadsheet = SpreadsheetApp.openById('11cqy_pzPzoZ3wLlu-ZAT_lhnCRqbvu5Mfz5Z-UPBjGg');
        const sheet = spreadsheet.getActiveSheet();

        // Get all data from the sheet
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        console.log("Total rows in sheet:", values.length);

        // Find the row with matching patient name and blood type
        let rowIndex = -1;
        for (let i = 1; i < values.length; i++) { // Start from 1 to skip header
            const patientName = values[i][2]; // Column C - Patient Name
            const bloodType = values[i][5]; // Column F - Required BG

            console.log(`Row ${i + 1}: Patient="${patientName}", BloodType="${bloodType}"`);
            console.log(`Looking for: Patient="${data.patientName}", BloodType="${data.bloodType}"`);

            if (patientName === data.patientName && bloodType === data.bloodType) {
                rowIndex = i + 1; // Convert to 1-based index
                console.log(`Found matching request at row ${rowIndex}`);
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`No matching request found for patient "${data.patientName}" with blood type "${data.bloodType}"`);
        }

        // Update the status in column L (12th column, 0-based index is 11)
        const statusCell = sheet.getRange(rowIndex, 12);
        statusCell.setValue(data.status);

        console.log(`Successfully updated status to "${data.status}" at row ${rowIndex}`);

        // Return success response
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                message: `Status updated to ${data.status} successfully`,
                rowIndex: rowIndex,
                patientName: data.patientName,
                bloodType: data.bloodType,
                newStatus: data.status,
                updatedAt: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error("Error updating status:", error);

        // Return error response
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Failed to update status',
                error: error.toString(),
                timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Modified doPost function to handle status updates
// Add this to your existing doPost function or replace it entirely
function doPost(e) {
    try {
        // Parse the incoming data - handle both JSON and form data
        let data;
        let action = null;

        console.log("Request type:", e.postData.type);
        console.log("Raw contents:", e.postData.contents);

        if (e.postData.type === 'application/x-www-form-urlencoded') {
            // Handle form data - decode URL encoding properly
            const formData = e.postData.contents;
            console.log("Raw form data:", formData);

            // Manual parsing of URL-encoded form data
            function parseFormData(formString) {
                const params = {};
                const pairs = formString.split('&');

                for (const pair of pairs) {
                    const [key, value] = pair.split('=');
                    if (key && value) {
                        // Decode URL encoding and replace + with spaces
                        const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
                        const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
                        params[decodedKey] = decodedValue;
                    }
                }
                return params;
            }

            const params = parseFormData(formData);
            console.log("Parsed form parameters:", params);

            // Check if this is a status update request
            if (params.action === 'update_status') {
                action = 'update_status';
                if (params.data) {
                    data = JSON.parse(params.data);
                } else {
                    // Extract data from other parameters
                    data = {
                        patientName: params.patientName,
                        bloodType: params.bloodType,
                        status: params.status
                    };
                }
            } else if (params.data) {
                // Regular form submission
                data = JSON.parse(params.data);
            } else {
                // If no 'data' parameter, try to parse the entire form data as JSON
                const decodedData = decodeURIComponent(formData.replace(/\+/g, ' '));
                console.log("Decoded form data:", decodedData);

                const jsonMatch = decodedData.match(/\{.*\}/);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No valid JSON found in form data");
                }
            }
        } else if (e.postData.type === 'application/json') {
            // Handle JSON data directly
            data = JSON.parse(e.postData.contents);

            // Check if this is a status update request
            if (data.action === 'update_status') {
                action = 'update_status';
            }
        } else {
            // Handle other content types or raw data
            const rawData = e.postData.contents;

            if (rawData.includes('%') || rawData.includes('+')) {
                const decodedData = decodeURIComponent(rawData.replace(/\+/g, ' '));
                console.log("Decoded raw data:", decodedData);

                const jsonMatch = decodedData.match(/\{.*\}/);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    data = JSON.parse(decodedData);
                }
            } else {
                data = JSON.parse(rawData);
            }
        }

        console.log("Successfully parsed data:", data);
        console.log("Action:", action);

        // Handle status update requests
        if (action === 'update_status') {
            return updateRequestStatus(data);
        }

        // Handle regular blood request submissions (your existing code)
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

// Test function for status updates
function testUpdateStatus() {
    const testData = {
        patientName: "Test Patient",
        bloodType: "A+",
        status: "Verified"
    };

    // Test with form data
    const formData = 'action=update_status&data=' + encodeURIComponent(JSON.stringify(testData));

    const response = doPost({
        postData: {
            type: 'application/x-www-form-urlencoded',
            contents: formData
        }
    });

    Logger.log("Status update test response:", response.getContent());
}

// Test function for closing a request
function testCloseRequest() {
    const testData = {
        patientName: "Test Patient",
        bloodType: "A+",
        status: "Closed"
    };

    // Test with form data
    const formData = 'action=update_status&data=' + encodeURIComponent(JSON.stringify(testData));

    const response = doPost({
        postData: {
            type: 'application/x-www-form-urlencoded',
            contents: formData
        }
    });

    Logger.log("Close request test response:", response.getContent());
}
