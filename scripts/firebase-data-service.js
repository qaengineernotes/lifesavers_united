// Firebase Data Service
// This module handles all Firebase Firestore operations for emergency requests
// Works alongside the existing Google Sheets integration

import {
    db,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion
} from './firebase-config.js';

// Flag to determine data source (can be toggled)
let USE_FIREBASE = true; // Set to true to use Firebase, false to use Google Sheets

// ============================================================================
// FETCH EMERGENCY REQUESTS FROM FIREBASE
// ============================================================================
export async function fetchEmergencyRequestsFromFirebase() {
    try {

        // Query all requests - ONLY 4 statuses: Open, Reopened, Verified, Closed
        const requestsRef = collection(db, 'emergency_requests');
        const q = query(
            requestsRef,
            where('status', 'in', ['Open', 'Reopened', 'Verified', 'Closed'])
        );

        const querySnapshot = await getDocs(q);
        const requests = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            requests.push({
                id: doc.id,
                // Map Firebase fields back to the format expected by the UI
                inquiryDate: data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt)) : new Date(),
                patientName: data.patientName || '',
                contactNumber: data.contactNumber || '',
                unitsRequired: parseInt(data.unitsRequired) || 0,
                unitsRequiredText: data.unitsRequired || '',
                bloodType: data.requiredBloodGroup || '',
                patientAge: data.patientAge || '',
                hospitalName: data.hospitalName || '',
                diagnosis: data.patientSufferingFrom || '',
                status: data.status || 'Open',
                urgency: data.urgencyLevel || '',
                hospitalAddress: data.hospitalAddress || '',
                city: data.hospitalCity || '',
                contactPerson: data.contactPerson || '',
                unitsFulfilled: data.unitsFulfilled || 0,
                unitsRemaining: (parseInt(data.unitsRequired) || 0) - (data.unitsFulfilled || 0),
                donors: data.donorSummary || '',
                additionalInfo: data.additionalInfo || '',
                verifiedBy: data.verifiedByName || '',
                closureReason: data.closureReason || '',
                fulfilledDate: data.fulfilledAt || ''
            });
        });

        // Sort by createdAt desc in memory to avoid needing a composite index
        requests.sort((a, b) => {
            const dateA = a.inquiryDate instanceof Date ? a.inquiryDate.getTime() : new Date(a.inquiryDate).getTime();
            const dateB = b.inquiryDate instanceof Date ? b.inquiryDate.getTime() : new Date(b.inquiryDate).getTime();
            return dateB - dateA;
        });



        // Calculate statistics from the fetched data (Optimized)
        let open = 0, reopened = 0, verified = 0, closed = 0, fulfilled = 0;
        requests.forEach(req => {
            const status = req.status;
            if (status === 'Open') open++;
            else if (status === 'Reopened') reopened++;
            else if (status === 'Verified') verified++;
            else if (status === 'Closed') {
                closed++;
                // Count only fulfilled closures (our donations) for "Lives Saved"
                if (req.closureType === 'fulfilled') {
                    fulfilled++;
                }
            }
        });

        const statistics = {
            total: requests.length,
            open,
            reopened,
            verified,
            closed,
            fulfilled // Only closures where we donated blood
        };

        return {
            success: true,
            requests: requests,
            count: requests.length,
            statistics: statistics,
            verifierNames: await getUniqueVerifiers(),
            timestamp: new Date().toISOString(),
            source: 'firebase'
        };

    } catch (error) {
        console.error('Error fetching from Firebase:', error);
        throw error;
    }
}

// ============================================================================
// CALCULATE STATISTICS FROM FIREBASE
// ============================================================================
async function calculateStatistics() {
    // Legacy function - ideally unused now as we calculate in fetchEmergencyRequestsFromFirebase
    // But kept for compatibility if called independently
    try {
        const requestsRef = collection(db, 'emergency_requests');
        // We can use getCountFromServer in future for optimization, 
        // but for now keeping it simple or reusing the implementation above if possible.
        // Since this is likely not called often anymore, existing implementation (or similar) is fine.
        const allRequests = await getDocs(requestsRef);

        let open = 0, reopened = 0, verified = 0, closed = 0, fulfilled = 0;

        allRequests.forEach((doc) => {
            const data = doc.data();
            const status = data.status;
            if (status === 'Open') open++;
            else if (status === 'Reopened') reopened++;
            else if (status === 'Verified') verified++;
            else if (status === 'Closed') {
                closed++;
                if (data.closureType === 'fulfilled') {
                    fulfilled++;
                }
            }
        });

        return {
            total: allRequests.size,
            open: open,
            reopened: reopened,
            verified: verified,
            closed: closed,
            fulfilled: fulfilled
        };
    } catch (error) {
        console.error('Error calculating statistics:', error);
        return { total: 0, open: 0, verified: 0, closed: 0 };
    }
}

// ============================================================================
// GET UNIQUE VERIFIERS
// ============================================================================
async function getUniqueVerifiers() {
    try {
        const requestsRef = collection(db, 'emergency_requests');
        const q = query(requestsRef, where('verifiedByName', '!=', ''));
        const querySnapshot = await getDocs(q);

        const verifiers = new Set();
        querySnapshot.forEach((doc) => {
            const verifierName = doc.data().verifiedByName;
            if (verifierName) verifiers.add(verifierName);
        });

        return Array.from(verifiers).sort();
    } catch (error) {
        console.error('Error fetching verifiers:', error);
        return [];
    }
}

// ============================================================================
// REAL-TIME LISTENER FOR EMERGENCY REQUESTS
// ============================================================================
export function listenToEmergencyRequests(callback) {
    const requestsRef = collection(db, 'emergency_requests');
    const q = query(
        requestsRef,
        where('status', 'in', ['Open', 'Reopened', 'Verified', 'Closed'])
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            requests.push({
                id: doc.id,
                inquiryDate: data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt)) : new Date(),
                patientName: data.patientName || '',
                contactNumber: data.contactNumber || '',
                unitsRequired: parseInt(data.unitsRequired) || 0,
                unitsRequiredText: data.unitsRequired || '',
                bloodType: data.requiredBloodGroup || '',
                patientAge: data.patientAge || '',
                hospitalName: data.hospitalName || '',
                diagnosis: data.patientSufferingFrom || '',
                status: data.status || 'Open',
                urgency: data.urgencyLevel || '',
                hospitalAddress: data.hospitalAddress || '',
                city: data.hospitalCity || '',
                contactPerson: data.contactPerson || '',
                unitsFulfilled: data.unitsFulfilled || 0,
                unitsRemaining: (parseInt(data.unitsRequired) || 0) - (data.unitsFulfilled || 0),
                donors: data.donorSummary || '',
                additionalInfo: data.additionalInfo || '',
                verifiedBy: data.verifiedByName || ''
            });
        });

        // Sort by createdAt desc in memory
        requests.sort((a, b) => {
            const dateA = a.inquiryDate instanceof Date ? a.inquiryDate.getTime() : new Date(a.inquiryDate).getTime();
            const dateB = b.inquiryDate instanceof Date ? b.inquiryDate.getTime() : new Date(b.inquiryDate).getTime();
            return dateB - dateA;
        });

        callback(requests);
    }, (error) => {
        console.error('Error in real-time listener:', error);
    });

    return unsubscribe; // Return function to stop listening
}

// ============================================================================
// UPDATE REQUEST STATUS (VERIFY)
// ============================================================================
export async function updateRequestStatusInFirebase(patientName, bloodType, newStatus, verifiedBy, currentUser, contactNumber = null) {
    try {
        // Find the request - try to be robust with names and types
        const requestsRef = collection(db, 'emergency_requests');
        let querySnapshot;

        // 1. Try matching by contact number if available (most reliable)
        if (contactNumber) {
            const contactVariations = [
                contactNumber,
                String(contactNumber).trim(),
                Number(contactNumber)
            ].filter(v => v !== undefined && v !== null && !isNaN(v));

            const q = query(
                requestsRef,
                where('contactNumber', 'in', Array.from(new Set(contactVariations)))
            );
            querySnapshot = await getDocs(q);
        }

        // 2. Fallback to exact patientName and bloodType
        if (!querySnapshot || querySnapshot.empty) {
            const q = query(
                requestsRef,
                where('patientName', '==', patientName),
                where('requiredBloodGroup', '==', bloodType)
            );
            querySnapshot = await getDocs(q);
        }

        // 3. Fallback to trimmed names
        if (querySnapshot.empty) {
            const q = query(
                requestsRef,
                where('patientName', '==', patientName.trim()),
                where('requiredBloodGroup', '==', bloodType.trim())
            );
            querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
            console.error('🔍 Request not found in Firebase for mirroring:', { patientName, bloodType, contactNumber });
            throw new Error(`Request not found for ${patientName} (${bloodType})`);
        }

        const requestDoc = querySnapshot.docs[0];
        const requestId = requestDoc.id;

        // Update the request
        const updateData = {
            status: newStatus,
            lastUpdatedByName: currentUser?.displayName || verifiedBy || 'Unknown',
            lastUpdatedByUid: currentUser?.uid || 'legacy'
        };

        if (newStatus === 'Verified') {
            updateData.verifiedByName = verifiedBy;
            updateData.verifiedByUid = currentUser?.uid || 'legacy';
        }

        await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

        // Add history entry
        await addHistoryEntry(requestId, {
            type: newStatus === 'Verified' ? 'VERIFIED' : 'STATUS_CHANGED',
            userName: verifiedBy || currentUser?.name || 'Unknown',
            userUid: currentUser?.uid || 'legacy',
            note: `Status changed to ${newStatus}`
        });

        return { success: true, message: 'Status updated successfully' };

    } catch (error) {
        console.error('Error updating status in Firebase:', error);
        throw error;
    }
}

// ============================================================================
// UPDATE REQUEST DETAILS (EDIT)
// ============================================================================
export async function updateRequestInFirebase(originalContactNumber, editedData, currentUser) {
    try {
        // Find the request by original contact number - try both string and number
        const requestsRef = collection(db, 'emergency_requests');
        const contactVariations = [
            originalContactNumber,
            String(originalContactNumber).trim(),
            Number(originalContactNumber)
        ].filter(v => v !== undefined && v !== null && !isNaN(v));

        const q = query(
            requestsRef,
            where('contactNumber', 'in', Array.from(new Set(contactVariations)))
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error('🔍 Request not found in Firebase for mirror update:', originalContactNumber);
            throw new Error('Request not found in Firebase');
        }

        const requestDoc = querySnapshot.docs[0];
        const requestId = requestDoc.id;
        const oldData = requestDoc.data(); // Get old data for comparison

        // Prepare update data (map UI fields to Firebase fields)
        const updateData = {
            patientName: editedData.patientName || '',
            patientAge: editedData.patientAge || '',
            patientSufferingFrom: editedData.diagnosis || '',
            requiredBloodGroup: editedData.bloodType || '',
            unitsRequired: editedData.unitsRequired || '',
            hospitalName: editedData.hospitalName || '',
            hospitalAddress: editedData.hospitalAddress || '',
            hospitalCity: editedData.city || '',
            contactPerson: editedData.contactPerson || '',
            contactNumber: editedData.contactNumber || originalContactNumber,
            urgencyLevel: editedData.urgency || 'Normal',
            additionalInfo: editedData.additionalInfo || '',
            updatedBy: currentUser?.displayName || 'Unknown',
            updatedByUid: currentUser?.uid || 'legacy',
            updatedAt: serverTimestamp(),
            // Legacy aliases for compatibility
            lastUpdatedByName: currentUser?.displayName || 'Unknown',
            lastUpdatedByUid: currentUser?.uid || 'legacy',
            lastUpdatedAt: serverTimestamp()
        };

        // Update the request
        await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

        // Compare old and new data to create changelog
        const changes = [];
        const fieldMap = {
            patientName: 'Patient Name',
            patientAge: 'Age',
            patientSufferingFrom: 'Diagnosis',
            requiredBloodGroup: 'Blood Group',
            unitsRequired: 'Units Required',
            hospitalName: 'Hospital',
            hospitalAddress: 'Hospital Address',
            hospitalCity: 'City',
            contactPerson: 'Contact Person',
            contactNumber: 'Contact Number',
            urgencyLevel: 'Urgency',
            additionalInfo: 'Additional Info'
        };

        for (const [key, label] of Object.entries(fieldMap)) {
            const oldValue = oldData[key] || '';
            const newValue = updateData[key] || '';
            if (oldValue !== newValue) {
                changes.push(`${label}: "${oldValue}" → "${newValue}"`);
            }
        }

        const changeNote = changes.length > 0
            ? `Updated: ${changes.join(', ')}`
            : 'Request details updated (no changes detected)';

        // Add history entry
        await addHistoryEntry(requestId, {
            type: 'EDITED',
            createdBy: currentUser?.displayName || 'Unknown',
            createdById: currentUser?.uid || 'legacy',
            note: changeNote,
            changes: changes // Store array of changes for future use
        });

        return { success: true, message: 'Request updated successfully' };

    } catch (error) {
        console.error('Error updating request in Firebase:', error);
        throw error;
    }
}

// ============================================================================
// LOG DONATION TO FIREBASE
// ============================================================================
export async function logDonationToFirebase(requestData, donationInfo, currentUser) {
    try {
        // Find the request - robust lookup
        const requestsRef = collection(db, 'emergency_requests');

        // Use contact number if available for better resolution
        let querySnapshot;
        if (requestData.contactNumber) {
            const contactVariations = [
                requestData.contactNumber,
                String(requestData.contactNumber).trim(),
                Number(requestData.contactNumber)
            ].filter(v => v !== undefined && v !== null && !isNaN(v));

            const q = query(
                requestsRef,
                where('contactNumber', 'in', Array.from(new Set(contactVariations)))
            );
            querySnapshot = await getDocs(q);
        }

        // Fallback to name and blood type if contact number query failed or wasn't available
        if (!querySnapshot || querySnapshot.empty) {
            const q = query(
                requestsRef,
                where('patientName', '==', requestData.patientName.trim()),
                where('requiredBloodGroup', '==', requestData.bloodType.trim())
            );
            querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
            console.error('🔍 Request not found in Firebase for donation log:', requestData);
            throw new Error('Request not found');
        }

        const requestDoc = querySnapshot.docs[0];
        const requestId = requestDoc.id;
        const currentData = requestDoc.data();

        const totalUnitsRequired = parseInt(currentData.unitsRequired) || 0;
        const currentReopenCount = currentData.reopenCount || 0;

        // ========================================================================
        // CASE 1: DONOR TYPE = "donor" (Our donation - create donation log)
        // ========================================================================
        if (donationInfo.donorType === 'donor') {
            const newUnitsFulfilled = (currentData.unitsFulfilled || 0) + parseInt(donationInfo.units);
            const willClose = newUnitsFulfilled >= totalUnitsRequired;

            // Update request with donation
            const updateData = {
                unitsFulfilled: newUnitsFulfilled,
                updatedBy: currentUser?.displayName || 'System',
                updatedByUid: currentUser?.uid || 'legacy',
                updatedAt: serverTimestamp(),
                lastUpdatedByName: currentUser?.displayName || 'System',
                lastUpdatedByUid: currentUser?.uid || 'legacy',
                lastUpdatedAt: serverTimestamp()
            };

            // Close if fulfilled
            if (willClose) {
                updateData.status = 'Closed';
                updateData.closedBy = currentUser?.displayName || 'System';
                updateData.closedByUid = currentUser?.uid || 'legacy';
                updateData.closedAt = serverTimestamp();
                updateData.closureReason = 'Blood fulfilled by our donors';
                updateData.closureType = 'fulfilled';
                updateData.fulfilledAt = new Date().toISOString();
            }

            await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

            // Generate donor ID for linking with duplicate detection
            let donorId = null;
            if (donationInfo.donorName && donationInfo.donorContact) {
                // --- DUPLICATE DETECTION: Search by Name OR Contact Number ---
                const donorsRef = collection(db, 'donors');
                let existingDonor = null;

                const searchName = (donationInfo.donorName || '').trim().toLowerCase();
                const searchContact = (donationInfo.donorContact || '').toString().trim();

                // 1. Search by Contact Number (most reliable)
                if (searchContact) {
                    const q = query(donorsRef, where('contactNumber', '==', searchContact));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        existingDonor = snapshot.docs[0];
                        donorId = existingDonor.id;
                        console.log(`🔍 Found existing donor by contact number: ${donorId}`);
                    }
                }

                // 2. Search by Name (if not found by contact)
                if (!existingDonor && searchName) {
                    // Query all donors and filter by case-insensitive name match
                    const allDonorsSnapshot = await getDocs(donorsRef);
                    allDonorsSnapshot.forEach((doc) => {
                        const data = doc.data();
                        const existingName = (data.fullName || '').trim().toLowerCase();
                        if (existingName === searchName) {
                            existingDonor = doc;
                            donorId = doc.id;
                            console.log(`🔍 Found existing donor by name: ${donorId}`);
                        }
                    });
                }

                // Generate ID if new donor
                if (!donorId) {
                    donorId = generateDonorId(donationInfo.donorName, donationInfo.donorContact);
                }

                // Update donor master record
                try {
                    const donorRef = doc(db, 'donors', donorId);

                    // Check if donor already exists (for blood group logic)
                    const existingDonorDoc = await getDoc(donorRef);
                    const donorExists = existingDonorDoc.exists();
                    const existingDonorData = donorExists ? existingDonorDoc.data() : null;

                    // Determine blood group to store
                    let bloodGroupToStore = '';

                    if (requestData.bloodType === 'Any') {
                        // Patient required blood group is "Any"
                        if (donorExists && existingDonorData.bloodGroup) {
                            // Existing donor - keep their existing blood group
                            bloodGroupToStore = existingDonorData.bloodGroup;
                        } else {
                            // New donor - keep empty (don't set to "Any")
                            bloodGroupToStore = '';
                        }
                    } else {
                        // Patient required specific blood group
                        if (donorExists && existingDonorData.bloodGroup) {
                            // Existing donor - keep their existing blood group
                            bloodGroupToStore = existingDonorData.bloodGroup;
                        } else {
                            // New donor - set to the specific blood group
                            bloodGroupToStore = requestData.bloodType;
                        }
                    }

                    const donorData = {
                        fullName: donationInfo.donorName,
                        contactNumber: donationInfo.donorContact,
                        bloodGroup: bloodGroupToStore,
                        lastDonatedAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser?.displayName || 'System'
                    };

                    await setDoc(donorRef, donorData, { merge: true });

                    console.log(`✅ Donor record updated: ${donorId}, Blood Group: "${bloodGroupToStore}" (Patient required: "${requestData.bloodType}", Donor ${donorExists ? 'existed' : 'new'})`);

                } catch (donorErr) {
                    console.error('❌ Failed to sync donor to master list:', donorErr);
                }
            }

            // Create donation log entry
            const donationLogRef = await addDoc(collection(db, 'donation_logs'), {
                requestId: requestId,
                donorId: donorId || 'none',
                patientName: requestData.patientName,
                bloodGroup: requestData.bloodType,
                unitsDonated: parseInt(donationInfo.units),
                donorType: 'donor',
                donorName: donationInfo.donorName || '',
                donorContact: donationInfo.donorContact || '',
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp(),
                createdBy: currentUser?.displayName || 'System',
                createdById: currentUser?.uid || 'legacy',
                recordedByName: currentUser?.displayName || currentUser?.name || 'System',
                recordedByUid: currentUser?.uid || 'legacy',
                reopenCycle: currentReopenCount
            });

            const donationLogId = donationLogRef.id;

            // Update donorSummary
            const currentSummary = currentData.donorSummary || '';
            const donorEntry = `${donationInfo.donorName || 'Anonymous'} (${donationInfo.units} unit${parseInt(donationInfo.units) > 1 ? 's' : ''})`;
            const newSummary = currentSummary ? `${currentSummary}, ${donorEntry}` : donorEntry;

            // Add donation ID to tracking arrays
            await updateDoc(doc(db, 'emergency_requests', requestId), {
                donorSummary: newSummary,
                donationLogIds: arrayUnion(donationLogId),
                allDonationLogIds: arrayUnion(donationLogId),
                lastDonationAt: serverTimestamp()
            });

            // Add to closure history if closing
            if (willClose) {
                const closureEntry = {
                    closedBy: currentUser?.displayName || 'System',
                    closedByUid: currentUser?.uid || 'legacy',
                    closedAt: new Date().toISOString(),
                    closureReason: 'Blood fulfilled by our donors',
                    closureType: 'fulfilled',
                    reopenCycle: currentReopenCount,
                    unitsFulfilled: newUnitsFulfilled,
                    donationLogIds: [donationLogId]
                };

                await updateDoc(doc(db, 'emergency_requests', requestId), {
                    closureHistory: arrayUnion(closureEntry),
                    totalClosures: (currentData.totalClosures || 0) + 1
                });
            }

            // Add history entry
            try {
                await addHistoryEntry(requestId, {
                    type: 'DONATION',
                    createdBy: currentUser?.displayName || currentUser?.name || 'Unknown',
                    createdById: currentUser?.uid || 'legacy',
                    donorName: donationInfo.donorName || '',
                    note: `${donationInfo.units} unit(s) donated by ${donationInfo.donorName || 'Unknown'}`
                });
            } catch (historyError) {
                console.error('⚠️ Failed to add history entry (donation still logged):', historyError);
            }

            return {
                success: true,
                autoClosed: willClose,
                unitsRemaining: totalUnitsRequired - newUnitsFulfilled,
                closureType: 'fulfilled'
            };
        }

        // ========================================================================
        // CASE 2: DONOR TYPE = "relative" (Relative donated - NO donation log)
        // ========================================================================
        else if (donationInfo.donorType === 'relative') {
            const closureReason = donationInfo.closureReason || 'Relative donated directly at hospital';

            // Close request without creating donation log
            const updateData = {
                status: 'Closed',
                closedBy: currentUser?.displayName || 'System',
                closedByUid: currentUser?.uid || 'legacy',
                closedAt: serverTimestamp(),
                closureReason: closureReason,
                closureType: 'relative',
                updatedBy: currentUser?.displayName || 'System',
                updatedByUid: currentUser?.uid || 'legacy',
                updatedAt: serverTimestamp(),
                lastUpdatedByName: currentUser?.displayName || 'System',
                lastUpdatedByUid: currentUser?.uid || 'legacy',
                lastUpdatedAt: serverTimestamp()
            };

            await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

            // Add to closure history
            const closureEntry = {
                closedBy: currentUser?.displayName || 'System',
                closedByUid: currentUser?.uid || 'legacy',
                closedAt: new Date().toISOString(),
                closureReason: closureReason,
                closureType: 'relative',
                reopenCycle: currentReopenCount,
                unitsFulfilled: 0,
                donationLogIds: []
            };

            await updateDoc(doc(db, 'emergency_requests', requestId), {
                closureHistory: arrayUnion(closureEntry),
                totalClosures: (currentData.totalClosures || 0) + 1
            });

            // Add history entry
            await addHistoryEntry(requestId, {
                type: 'CLOSED',
                createdBy: currentUser?.displayName || currentUser?.name || 'Unknown',
                createdById: currentUser?.uid || 'legacy',
                note: `Request closed - ${closureReason}`
            });

            return {
                success: true,
                autoClosed: true,
                unitsRemaining: 0,
                closureType: 'relative'
            };
        }

        // ========================================================================
        // CASE 3: DONOR TYPE = "other" (Other reason - NO donation log)
        // ========================================================================
        else if (donationInfo.donorType === 'other') {
            const closureReason = donationInfo.closureReason || 'Request closed for other reason';

            // Close request without creating donation log
            const updateData = {
                status: 'Closed',
                closedBy: currentUser?.displayName || 'System',
                closedByUid: currentUser?.uid || 'legacy',
                closedAt: serverTimestamp(),
                closureReason: closureReason,
                closureType: 'other',
                updatedBy: currentUser?.displayName || 'System',
                updatedByUid: currentUser?.uid || 'legacy',
                updatedAt: serverTimestamp(),
                lastUpdatedByName: currentUser?.displayName || 'System',
                lastUpdatedByUid: currentUser?.uid || 'legacy',
                lastUpdatedAt: serverTimestamp()
            };

            await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

            // Add to closure history
            const closureEntry = {
                closedBy: currentUser?.displayName || 'System',
                closedByUid: currentUser?.uid || 'legacy',
                closedAt: new Date().toISOString(),
                closureReason: closureReason,
                closureType: 'other',
                reopenCycle: currentReopenCount,
                unitsFulfilled: 0,
                donationLogIds: []
            };

            await updateDoc(doc(db, 'emergency_requests', requestId), {
                closureHistory: arrayUnion(closureEntry),
                totalClosures: (currentData.totalClosures || 0) + 1
            });

            // Add history entry
            await addHistoryEntry(requestId, {
                type: 'CLOSED',
                createdBy: currentUser?.displayName || currentUser?.name || 'Unknown',
                createdById: currentUser?.uid || 'legacy',
                note: `Request closed - ${closureReason}`
            });

            return {
                success: true,
                autoClosed: true,
                unitsRemaining: 0,
                closureType: 'other'
            };
        }

    } catch (error) {
        console.error('Error logging donation to Firebase:', error);
        throw error;
    }
}

// ============================================================================
// ADD HISTORY ENTRY
// ============================================================================
async function addHistoryEntry(requestId, data) {
    try {
        const historyRef = collection(db, 'emergency_requests', requestId, 'updates');

        const historyEntry = {
            timestamp: serverTimestamp(),
            type: data.type,
            userName: data.createdBy || data.userName || 'Unknown', // Support both field names
            userUid: data.createdById || data.userUid || 'legacy', // Support both field names
            note: data.note
        };

        // Add donorName if provided (for donation entries)
        if (data.donorName) {
            historyEntry.donorName = data.donorName;
        }

        // Add changes array if provided (for edit entries)
        if (data.changes && Array.isArray(data.changes)) {
            historyEntry.changes = data.changes;
        }

        await addDoc(historyRef, historyEntry);

    } catch (error) {
        console.error('❌ Error adding history entry:', error);
        // Don't throw - let the caller decide how to handle
    }
}

// ============================================================================
// CREATE NEW REQUEST IN FIREBASE (Public Submission)
// ============================================================================
export async function createNewRequestInFirebase(requestData, currentUser = null) {
    try {
        const requestsRef = collection(db, 'emergency_requests');
        let existingDoc = null;
        let requestId = null;

        // --- 1. SEARCH FOR EXISTING REQUEST (Duplicate Detection) ---
        // Normalize search parameters
        const searchName = (requestData.patientName || '').trim();
        const searchContact = (requestData.contactNumber || '').toString().trim();



        // Query by Contact Number (Highly Reliable)
        if (searchContact) {
            const q = query(requestsRef, where('contactNumber', '==', searchContact));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                existingDoc = snapshot.docs[0];

            }
        }

        // Query by Patient Name (Fallback)
        if (!existingDoc && searchName) {
            const q = query(requestsRef, where('patientName', '==', searchName));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                existingDoc = snapshot.docs[0];

            }
        }

        if (existingDoc) {
            requestId = existingDoc.id;
            const currentData = existingDoc.data();


            // Prepare update data for Reopen
            const updateData = {
                // Update basic info with potentially new details
                patientAge: requestData.patientAge || currentData.patientAge || '',
                patientSufferingFrom: requestData.diagnosis || currentData.patientSufferingFrom || '',
                requiredBloodGroup: requestData.bloodType || currentData.requiredBloodGroup || '',
                unitsRequired: requestData.unitsRequired || currentData.unitsRequired || '',

                // RESET donation tracking for new cycle
                unitsFulfilled: 0,
                donorSummary: '',
                donationLogIds: [],

                hospitalName: requestData.hospitalName || currentData.hospitalName || '',
                hospitalAddress: requestData.hospitalAddress || currentData.hospitalAddress || '',
                hospitalCity: requestData.city || currentData.hospitalCity || '',

                contactPerson: requestData.contactPerson || currentData.contactPerson || '',
                contactNumber: searchContact || currentData.contactNumber || '',

                // Status Update
                status: 'Reopened',
                urgencyLevel: requestData.urgency || currentData.urgencyLevel || 'Normal',
                additionalInfo: requestData.additionalInfo || currentData.additionalInfo || '',

                // Audit - Track who reopened
                updatedBy: currentUser?.displayName || requestData.patientName || 'Public',
                updatedByUid: currentUser?.uid || 'public',
                updatedAt: serverTimestamp(),
                lastUpdatedByName: currentUser?.displayName || requestData.patientName || 'Public',
                lastUpdatedAt: serverTimestamp(),
                createdAt: serverTimestamp(), // Bring to top of list
                source: currentUser ? 'user_reopen' : 'public_submission_reopened',
                reopenedAt: serverTimestamp()
            };

            // PRESERVE donation history
            if (currentData.donationLogIds && currentData.donationLogIds.length > 0) {
                const currentAllDonations = currentData.allDonationLogIds || [];
                updateData.allDonationLogIds = [...currentAllDonations, ...currentData.donationLogIds];
            }

            // Track reopen count
            const currentReopenCount = currentData.reopenCount || 0;
            updateData.reopenCount = currentReopenCount + 1;

            await updateDoc(doc(db, 'emergency_requests', requestId), updateData);

            // Add history entry for reopen
            await addHistoryEntry(requestId, {
                type: 'REOPENED',
                createdBy: currentUser?.displayName || requestData.patientName || 'Public',
                createdById: currentUser?.uid || 'public',
                note: currentUser
                    ? `Request reopened by ${currentUser.displayName}`
                    : 'Request reopened via public form'
            });


            return { success: true, requestId: requestId, action: 'REOPENED' };
        }

        // --- 2. CREATE NEW REQUEST (If no duplicate found) ---
        requestId = generateRequestId(requestData.patientName, requestData.contactNumber);

        const firestoreData = {
            createdAt: serverTimestamp(),
            patientName: requestData.patientName || '',
            patientAge: requestData.patientAge || '',
            patientSufferingFrom: requestData.diagnosis || '',
            requiredBloodGroup: requestData.bloodType || '',
            unitsRequired: requestData.unitsRequired || '',
            unitsFulfilled: 0,
            hospitalName: requestData.hospitalName || '',
            hospitalAddress: requestData.hospitalAddress || '',
            hospitalCity: requestData.city || '',
            contactPerson: requestData.contactPerson || '',
            contactNumber: requestData.contactNumber || '',
            urgencyLevel: requestData.urgency || 'Normal',
            status: 'Open',
            additionalInfo: requestData.additionalInfo || '',

            // Track who created - logged in user or public
            createdByName: currentUser?.displayName || requestData.patientName || 'Unknown',
            createdByUid: currentUser?.uid || 'public',

            verifiedByName: '',
            verifiedByUid: '',
            donorSummary: '',
            closureReason: '',
            fulfilledAt: '',
            source: currentUser ? 'user_submission' : 'public_submission'
        };

        await setDoc(doc(db, 'emergency_requests', requestId), firestoreData);

        // Add history entry for creation
        await addHistoryEntry(requestId, {
            type: 'CREATED',
            createdBy: currentUser?.displayName || requestData.patientName || 'Unknown',
            createdById: currentUser?.uid || 'public',
            note: currentUser
                ? `Request created by ${currentUser.displayName}`
                : 'Request submitted via public form'
        });


        return { success: true, requestId: requestId, action: 'CREATED' };

    } catch (error) {
        console.error('Error in createNewRequestInFirebase:', error);
        throw error;
    }
}

// Helper function to generate request ID
function generateRequestId(patientName, contactNumber) {
    const cleanName = (patientName || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanContact = (contactNumber || '').toString().replace(/[^0-9]/g, '');
    return `${cleanName}_${cleanContact}_${Date.now()}`;
}

// ============================================================================
// REGISTER DONOR IN FIREBASE (Public Registration)
// ============================================================================
export async function registerDonorInFirebase(donorData) {
    try {
        const donorsRef = collection(db, 'donors');
        let existingDonor = null;
        let donorId = null;

        // --- DUPLICATE DETECTION: Search by Name OR Contact Number ---
        const searchName = (donorData.fullName || '').trim().toLowerCase();
        const searchContact = (donorData.contactNumber || '').toString().trim();

        // 1. Search by Contact Number (most reliable)
        if (searchContact) {
            const q = query(donorsRef, where('contactNumber', '==', searchContact));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                existingDonor = snapshot.docs[0];
                donorId = existingDonor.id;
                console.log(`🔍 Found existing donor by contact number: ${donorId}`);
            }
        }

        // 2. Search by Name (if not found by contact)
        if (!existingDonor && searchName) {
            // Query all donors and filter by case-insensitive name match
            const allDonorsSnapshot = await getDocs(donorsRef);
            allDonorsSnapshot.forEach((doc) => {
                const data = doc.data();
                const existingName = (data.fullName || '').trim().toLowerCase();
                if (existingName === searchName) {
                    existingDonor = doc;
                    donorId = doc.id;
                    console.log(`🔍 Found existing donor by name: ${donorId}`);
                }
            });
        }

        // Calculate age from date of birth if provided
        let age = 0;
        if (donorData.dateOfBirth) {
            const birthDate = new Date(donorData.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        // Prepare Firestore data
        const firestoreData = {
            fullName: donorData.fullName || '',
            contactNumber: donorData.contactNumber || '',
            bloodGroup: donorData.bloodGroup || '',
            area: donorData.area || '',
            city: donorData.city || '',
            // Handle both field names for emergency availability
            isEmergencyAvailable: donorData.emergencyAvailable || donorData.isEmergencyAvailable || '',
            dateOfBirth: donorData.dateOfBirth || '',
            gender: donorData.gender || '',
            preferredContact: donorData.preferredContact || '',
            age: age,
            weight: donorData.weight || '',
            // Handle both field names for last donation
            lastDonatedAt: donorData.lastDonation || donorData.lastDonatedAt || '',
            medicalHistory: donorData.medicalHistory || '',
            email: donorData.email || '',
            updatedAt: serverTimestamp(),
            updatedBy: donorData.registeredBy || 'System'
        };

        // Add fields that should only be set if they don't exist (for existing donors)
        // or always set for new donors
        if (existingDonor) {
            const existingData = existingDonor.data();
            // Only set these fields if they don't already exist (preserve original values)
            if (existingData.registeredAt) {
                firestoreData.registeredAt = existingData.registeredAt;
            } else {
                firestoreData.registeredAt = serverTimestamp();
            }

            if (existingData.createdAt) {
                firestoreData.createdAt = existingData.createdAt;
            } else {
                firestoreData.createdAt = serverTimestamp();
            }

            if (existingData.createdBy) {
                firestoreData.createdBy = existingData.createdBy;
            } else {
                firestoreData.createdBy = donorData.registeredBy || 'System (Public Registration)';
            }

            if (existingData.createdByUid !== undefined) {
                firestoreData.createdByUid = existingData.createdByUid;
            } else {
                firestoreData.createdByUid = donorData.registeredByUid || null;
            }

            if (existingData.source) {
                firestoreData.source = existingData.source;
            } else {
                firestoreData.source = 'public_registration';
            }

            if (existingData.registrationDate) {
                firestoreData.registrationDate = existingData.registrationDate;
            } else {
                firestoreData.registrationDate = donorData.registrationDate || new Date().toISOString();
            }
        } else {
            // New donor - set all fields
            firestoreData.registeredAt = serverTimestamp();
            firestoreData.createdAt = serverTimestamp();
            firestoreData.createdBy = donorData.registeredBy || 'System (Public Registration)';
            firestoreData.createdByUid = donorData.registeredByUid || null;
            firestoreData.source = 'public_registration';
            firestoreData.registrationDate = donorData.registrationDate || new Date().toISOString();
        }

        // Generate ID if new donor
        if (!donorId) {
            donorId = generateDonorId(donorData.fullName, donorData.contactNumber);
        }

        // Save to Firestore (merge if existing, create if new)
        await setDoc(doc(db, 'donors', donorId), firestoreData, { merge: true });

        if (existingDonor) {
            console.log('✅ Existing donor updated in Firebase:', donorId);
            return { success: true, donorId: donorId, action: 'UPDATED' };
        } else {
            console.log('✅ New donor registered in Firebase:', donorId);
            return { success: true, donorId: donorId, action: 'CREATED' };
        }

    } catch (error) {
        console.error('❌ Error registering donor in Firebase:', error);
        throw error;
    }
}

// Helper function to generate donor ID
function generateDonorId(name, contact) {
    const cleanName = (name || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanContact = (contact || '').toString().replace(/[^0-9]/g, '');
    return cleanContact ? `${cleanName}_${cleanContact}` : `${cleanName}_${Date.now()}`;
}

// ============================================================================
// EXPORT DATA SOURCE TOGGLE
// ============================================================================
export function setDataSource(useFirebase) {
    USE_FIREBASE = useFirebase;

}

export function getDataSource() {
    return USE_FIREBASE ? 'firebase' : 'google_sheets';
}
