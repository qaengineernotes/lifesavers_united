// Google Apps Script for Life Savers Donors
// Handles both Emergency Blood Requests and Donor Registration

function doPost(e) {
    try {
        // Parse the incoming data
        const data = JSON.parse(e.parameter.data);
        const action = e.parameter.action;

        // Get the active spreadsheet
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

        let result = {};

        switch (action) {
            case 'register_donor':
                result = handleDonorRegistration(spreadsheet, data);
                break;
            case 'update_status':
                result = handleStatusUpdate(spreadsheet, data);
                break;
            case 'save_donor_details':
                result = handleSaveDonorDetails(spreadsheet, data);
                break;
            default:
                // Handle emergency blood request (legacy)
                result = handleEmergencyRequest(spreadsheet, data);
        }

        return ContentService
            .createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error('Error in doPost:', error);
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Server error: ' + error.toString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    try {
        // Get emergency requests for the dashboard
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const requests = getEmergencyRequests(spreadsheet);
        const statistics = getStatistics(spreadsheet);

        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                requests: requests,
                statistics: statistics
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        console.error('Error in doGet:', error);
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                message: 'Server error: ' + error.toString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Handle donor registration
function handleDonorRegistration(spreadsheet, data) {
    try {
        // Get or create the Donor Registration sheet
        let donorSheet = spreadsheet.getSheetByName('Donor Registration');
        if (!donorSheet) {
            donorSheet = spreadsheet.insertSheet('Donor Registration');

            // Add headers
            const headers = [
                'Registration Date',
                'Full Name',
                'Date of Birth',
                'Age',
                'Gender',
                'Contact Number',
                'Email',
                'Weight (kg)',
                'Blood Group',
                'City',
                'Area/Locality',
                'Emergency Available',
                'Preferred Contact',
                'Last Donation Date',
                'Medical History',
                'Status'
            ];
            donorSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

            // Format headers
            const headerRange = donorSheet.getRange(1, 1, 1, headers.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f0f0');
        }

        // Calculate age
        const birthDate = new Date(data.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Prepare row data
        const rowData = [
            new Date(data.registrationDate),
            data.fullName,
            new Date(data.dateOfBirth),
            age,
            data.gender,
            data.contactNumber,
            data.email,
            parseInt(data.weight),
            data.bloodGroup,
            data.city,
            data.area,
            data.emergencyAvailable,
            data.preferredContact,
            data.lastDonation ? new Date(data.lastDonation) : '',
            data.medicalHistory,
            'Active'
        ];

        // Add the new row
        donorSheet.appendRow(rowData);

        // Auto-resize columns
        donorSheet.autoResizeColumns(1, donorSheet.getLastColumn());

        return {
            success: true,
            message: 'Donor registered successfully!'
        };

    } catch (error) {
        console.error('Error in handleDonorRegistration:', error);
        return {
            success: false,
            message: 'Failed to register donor: ' + error.toString()
        };
    }
}

// Handle emergency blood request (legacy function)
function handleEmergencyRequest(spreadsheet, data) {
    try {
        // Get or create the Emergency Requests sheet
        let requestSheet = spreadsheet.getSheetByName('Emergency Requests');
        if (!requestSheet) {
            requestSheet = spreadsheet.insertSheet('Emergency Requests');

            // Add headers
            const headers = [
                'Inquiry Date',
                'Patient Name',
                'Contact Person',
                'Contact Number',
                'Contact Email',
                'Blood Type',
                'Units Required',
                'Patient Age',
                'Diagnosis',
                'Urgency',
                'Hospital Name',
                'City',
                'Hospital Address',
                'Additional Info',
                'Status'
            ];
            requestSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

            // Format headers
            const headerRange = requestSheet.getRange(1, 1, 1, headers.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f0f0');
        }

        // Check for duplicate active requests
        const dataRange = requestSheet.getDataRange();
        const values = dataRange.getValues();

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row[1] === data.patientName && row[14] === 'Open') {
                return {
                    success: false,
                    error: 'DUPLICATE_ACTIVE_REQUEST',
                    message: 'A blood request for this patient is already open.'
                };
            }
        }

        // Prepare row data
        const rowData = [
            new Date(),
            data.patientName,
            data.contactPerson,
            data.contactNumber,
            data.contactEmail,
            data.bloodType,
            data.unitsRequired,
            data.patientAge,
            data.diagnosis,
            data.urgency,
            data.hospitalName,
            data.city,
            data.hospitalAddress,
            data.additionalInfo,
            'Open'
        ];

        // Add the new row
        requestSheet.appendRow(rowData);

        // Auto-resize columns
        requestSheet.autoResizeColumns(1, requestSheet.getLastColumn());

        return {
            success: true,
            message: 'Emergency blood request submitted successfully!'
        };

    } catch (error) {
        console.error('Error in handleEmergencyRequest:', error);
        return {
            success: false,
            message: 'Failed to submit emergency request: ' + error.toString()
        };
    }
}

// Handle status updates (Verify/Close)
function handleStatusUpdate(spreadsheet, data) {
    try {
        const requestSheet = spreadsheet.getSheetByName('Emergency Requests');
        if (!requestSheet) {
            return {
                success: false,
                message: 'Emergency Requests sheet not found'
            };
        }

        const dataRange = requestSheet.getDataRange();
        const values = dataRange.getValues();

        // Find the matching request
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row[1] === data.patientName && row[5] === data.bloodType) {
                // Update the status
                requestSheet.getRange(i + 1, 15).setValue(data.status);

                return {
                    success: true,
                    message: `Request status updated to ${data.status}`
                };
            }
        }

        return {
            success: false,
            message: 'Request not found'
        };

    } catch (error) {
        console.error('Error in handleStatusUpdate:', error);
        return {
            success: false,
            message: 'Failed to update status: ' + error.toString()
        };
    }
}

// Handle saving donor details
function handleSaveDonorDetails(spreadsheet, data) {
    try {
        // Get or create the Donor Details sheet
        let donorDetailsSheet = spreadsheet.getSheetByName('Donor Details');
        if (!donorDetailsSheet) {
            donorDetailsSheet = spreadsheet.insertSheet('Donor Details');

            // Add headers
            const headers = [
                'Date',
                'Donor Name',
                'Donor Contact',
                'Patient Name',
                'Blood Type',
                'Status'
            ];
            donorDetailsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

            // Format headers
            const headerRange = donorDetailsSheet.getRange(1, 1, 1, headers.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f0f0');
        }

        // Prepare row data
        const rowData = [
            new Date(),
            data.donorName,
            data.donorContact,
            data.patientName,
            data.bloodType,
            'Donated'
        ];

        // Add the new row
        donorDetailsSheet.appendRow(rowData);

        // Auto-resize columns
        donorDetailsSheet.autoResizeColumns(1, donorDetailsSheet.getLastColumn());

        return {
            success: true,
            message: 'Donor details saved successfully!'
        };

    } catch (error) {
        console.error('Error in handleSaveDonorDetails:', error);
        return {
            success: false,
            message: 'Failed to save donor details: ' + error.toString()
        };
    }
}

// Get emergency requests for dashboard
function getEmergencyRequests(spreadsheet) {
    try {
        const requestSheet = spreadsheet.getSheetByName('Emergency Requests');
        if (!requestSheet) {
            return [];
        }

        const dataRange = requestSheet.getDataRange();
        const values = dataRange.getValues();

        if (values.length <= 1) {
            return [];
        }

        const requests = [];
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row[14] === 'Open' || row[14] === 'Verified') {
                requests.push({
                    inquiryDate: row[0],
                    patientName: row[1],
                    contactPerson: row[2],
                    contactNumber: row[3],
                    contactEmail: row[4],
                    bloodType: row[5],
                    unitsRequired: row[6],
                    patientAge: row[7],
                    diagnosis: row[8],
                    urgency: row[9],
                    hospitalName: row[10],
                    city: row[11],
                    hospitalAddress: row[12],
                    additionalInfo: row[13],
                    status: row[14]
                });
            }
        }

        return requests;

    } catch (error) {
        console.error('Error in getEmergencyRequests:', error);
        return [];
    }
}

// Get statistics for dashboard
function getStatistics(spreadsheet) {
    try {
        const requestSheet = spreadsheet.getSheetByName('Emergency Requests');
        if (!requestSheet) {
            return { total: 0, open: 0, verified: 0, closed: 0 };
        }

        const dataRange = requestSheet.getDataRange();
        const values = dataRange.getValues();

        if (values.length <= 1) {
            return { total: 0, open: 0, verified: 0, closed: 0 };
        }

        let total = 0;
        let open = 0;
        let verified = 0;
        let closed = 0;

        for (let i = 1; i < values.length; i++) {
            const status = values[i][14];
            total++;

            switch (status) {
                case 'Open':
                    open++;
                    break;
                case 'Verified':
                    verified++;
                    break;
                case 'Closed':
                    closed++;
                    break;
            }
        }

        return { total, open, verified, closed };

    } catch (error) {
        console.error('Error in getStatistics:', error);
        return { total: 0, open: 0, verified: 0, closed: 0 };
    }
}

// Utility function to create test data (for development)
function createTestData() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Create test donor registration
    const testDonorData = {
        fullName: 'Test Donor',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        contactNumber: '9876543210',
        email: 'test@example.com',
        weight: '70',
        bloodGroup: 'O+',
        city: 'Ahmedabad',
        area: 'Vastrapur',
        emergencyAvailable: 'Yes',
        preferredContact: 'Phone',
        lastDonation: '',
        medicalHistory: 'No known medical conditions',
        registrationDate: new Date().toISOString()
    };

    handleDonorRegistration(spreadsheet, testDonorData);

    console.log('Test data created successfully');
}
