# Firebase Deployment Guide - Telegram Bot Update

## ⚠️ PowerShell Execution Policy Issue

You're encountering a PowerShell execution policy restriction. Here are **3 solutions**:

---

## ✅ **Solution 1: Use Command Prompt (Recommended)**

1. **Open Command Prompt** (not PowerShell):
   - Press `Win + R`
   - Type `cmd`
   - Press Enter

2. **Navigate to your project:**
   ```cmd
   cd "d:\Lifesavers United\life_savers_donors\life_savers_donors"
   ```

3. **Deploy the function:**
   ```cmd
   firebase deploy --only functions:telegramBot
   ```

---

## ✅ **Solution 2: Change PowerShell Execution Policy (Admin Required)**

1. **Open PowerShell as Administrator**:
   - Right-click PowerShell
   - Select "Run as Administrator"

2. **Set execution policy:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Confirm with `Y`**

4. **Then deploy:**
   ```powershell
   cd "d:\Lifesavers United\life_savers_donors\life_savers_donors"
   firebase deploy --only functions:telegramBot
   ```

---

## ✅ **Solution 3: Bypass Policy for Single Command**

In PowerShell, run:
```powershell
powershell -ExecutionPolicy Bypass -Command "cd 'd:\Lifesavers United\life_savers_donors\life_savers_donors'; firebase deploy --only functions:telegramBot"
```

---

## 📋 **What Will Happen During Deployment:**

1. Firebase CLI will compile your functions
2. Upload the updated `telegramBot` function
3. You'll see output like:
   ```
   ✔  functions[telegramBot(us-central1)] Successful update operation.
   ✔  Deploy complete!
   ```

---

## 🧪 **After Deployment - Testing:**

Send a test message to your Telegram bot:

### **Test 1: Update Single Field**
```
Patient Name: Aabhay Mishra
Age: 29
Blood Group: B+
Units Required: 3 SDP
Hospital: New Hospital
Location: Asharva
Suffering from: Cancer
Contact Number: 9878987898
```

**Expected Response:**
```
✅ Request Updated & Saved

✅ Database confirmed!
Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_...

📝 Updated fields:
• Units Required: 1 SDP → 3 SDP
• Hospital: Old Hospital → New Hospital
```

### **Test 2: Exact Duplicate (Active Request)**
Send the **exact same message** again.

**Expected Response:**
```
ℹ️ Request Already Exists

Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_...
Status: Open

⚠️ No changes detected - no action taken
```

---

## 🔍 **Troubleshooting:**

If deployment fails, check:
1. You're logged into Firebase: `firebase login`
2. Correct project selected: `firebase use --add`
3. Functions dependencies installed: `cd functions && npm install`

---

## 📞 **Need Help?**

If you encounter any issues during deployment, let me know and I can help troubleshoot!
