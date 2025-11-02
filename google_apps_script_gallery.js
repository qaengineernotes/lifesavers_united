function doGet() {
    try {
        // Get the shared folder by ID
        const folderId = '1DQNsBW3PIM3QtmsturZpKj4IiM4DICpX';
        const folder = DriveApp.getFolderById(folderId);

        // Get all image files from the folder
        const files = folder.getFiles();
        const images = [];
        let id = 1;

        while (files.hasNext()) {
            const file = files.next();
            const name = file.getName();
            const fileId = file.getId();
            const date = file.getDateCreated();

            // Only process image files
            if (file.getMimeType().startsWith('image/')) {
                // Ensure file is publicly accessible (viewer permission)
                // This is required for images to display in web pages
                try {
                    // Check if file is already shared publicly
                    const access = file.getSharingAccess();
                    if (access !== DriveApp.Access.ANYONE_WITH_LINK && access !== DriveApp.Access.ANYONE) {
                        // Share file with anyone who has the link (viewer only)
                        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                    }
                } catch (shareError) {
                    // If sharing fails, log but continue
                    console.error('Sharing failed for file:', name, shareError);
                }

                // Use Googleusercontent thumbnail URL format for direct display
                // This format works best in <img> tags when file is publicly shared
                // w1200 = width 1200px (adjust as needed: w400, w800, w1200, w1920, etc.)
                const url = `https://lh3.googleusercontent.com/d/${fileId}=w1200`;

                // Fallback: If googleusercontent doesn't work, use this format:
                // const url = `https://drive.google.com/uc?id=${fileId}`;
                // Note: Requires file to be publicly accessible

                // Determine category based on filename
                let category = 'gallery';
                const nameLower = name.toLowerCase();

                if (nameLower.includes('blood') || nameLower.includes('donation') || nameLower.includes('camp')) {
                    category = 'blood-donation';
                } else if (nameLower.includes('event')) {
                    category = 'events';
                } else if (nameLower.includes('volunteer')) {
                    category = 'volunteers';
                } else if (nameLower.includes('award') || nameLower.includes('recognition')) {
                    category = 'awards';
                }

                images.push({
                    id: id++,
                    url: url,
                    name: name,
                    date: date,
                    category: category
                });
            }
        }

        // Sort by date (newest first)
        images.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Return the images as JSON
        return ContentService
            .createTextOutput(JSON.stringify(images))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // Return error if something goes wrong
        return ContentService
            .createTextOutput(JSON.stringify({ error: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

