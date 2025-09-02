# 🧪 TEST CHROME EXTENSION - CRITICAL STEP

## 1. INSTALL EXTENSION LOCALLY (2 minutes)

1. **Open Chrome**
2. **Go to:** `chrome://extensions/`
3. **Enable "Developer mode"** (top right toggle)
4. **Click "Load unpacked"**
5. **Select folder:** `/mnt/c/Users/millz/Parserator/chrome-extension/`
6. **Should see Parserator extension appear**

## 2. CONFIGURE API KEY (1 minute)

1. **Click extension icon** in Chrome toolbar
2. **Go to Settings/Options**
3. **Enter API key:** `pk_test_demo123456789012345678901234567890`
4. **API URL should auto-fill:** `https://app-5108296280.us-central1.run.app`
5. **Click Save**

## 3. CRITICAL TESTS (5 minutes)

### Test 1: Popup Parsing
1. **Click extension icon**
2. **Paste test data:** `John Smith, john@example.com, (555) 123-4567`
3. **Set schema:** `{"name": "string", "email": "email", "phone": "phone"}`
4. **Click Parse**
5. **Should get JSON result**

### Test 2: Right-Click Context Menu
1. **Go to any webpage**
2. **Select some text**
3. **Right-click → "Parse with Parserator"**
4. **Should open side panel or popup with results**

### Test 3: Keyboard Shortcut
1. **Select text on any page**
2. **Press Ctrl+Shift+P**
3. **Should trigger parsing**

### Test 4: Side Panel
1. **Open extension**
2. **Click side panel option**
3. **Test advanced parsing features**

## 4. WHAT TO CHECK

- ✅ Extension icon appears in toolbar
- ✅ Popup opens without errors
- ✅ API connection works (shows green status)
- ✅ Parsing returns valid JSON
- ✅ Right-click menu appears
- ✅ Keyboard shortcuts work
- ✅ No console errors (F12 → Console)
- ✅ Results can be copied/exported

## 5. TAKE SCREENSHOTS WHILE TESTING

1. **Main popup with parsing in progress**
2. **Successful parsing results**
3. **Right-click context menu**
4. **Side panel interface**
5. **Settings/configuration page**

## 6. IF SOMETHING BREAKS

- Check browser console (F12)
- Verify API URL is correct
- Test API directly: https://app-5108296280.us-central1.run.app/health
- Check if CORS is working
- Verify permissions in manifest.json

## 7. AFTER TESTING

- Fix any bugs found
- Re-zip extension if changes needed
- Take professional screenshots for Web Store
- Submit with confidence

---

**TEST EVERYTHING BEFORE SUBMITTING TO 2 BILLION CHROME USERS!** 🚨