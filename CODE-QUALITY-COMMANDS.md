# Shopify App Code Quality Commands 🔧

## Available Commands to Fix Syntax & Code Errors

### 1. **ESLint - Check for Errors**
```bash
npm run lint
```
Or directly:
```bash
npx eslint --cache --cache-location ./node_modules/.cache/eslint .
```

**What it does:**
- Checks for syntax errors
- Finds unused variables
- Detects code quality issues
- Shows TypeScript errors

---

### 2. **ESLint - Auto-Fix Errors**
```bash
npx eslint --cache --cache-location ./node_modules/.cache/eslint . --fix
```

**What it does:**
- Automatically fixes formatting issues
- Removes unused imports
- Fixes simple syntax errors
- **Note:** Can't fix all errors, some need manual intervention

---

### 3. **TypeScript - Type Checking**
```bash
npx tsc --noEmit
```

**What it does:**
- Checks TypeScript types
- Finds type mismatches
- Shows compilation errors
- Doesn't generate any files (`--noEmit`)

---

### 4. **Prettier - Format Code** (if installed)
```bash
npx prettier --write "app/**/*.{js,jsx,ts,tsx}"
```

**What it does:**
- Auto-formats code
- Fixes indentation
- Consistent code style
- Makes code more readable

---

### 5. **Build Check - Test Compilation**
```bash
npm run build
```

**What it does:**
- Attempts to build the entire app
- Shows all compilation errors
- Verifies everything works together

---

## Current Errors in Your App

### Found in `app/routes/app.studio.tsx`:
```
✖ 4 errors:
  - 'shop' is assigned but never used
  - 'setSelectedModel' is assigned but never used  
  - 'setSelectedPoses' is assigned but never used
  - 'setIsGenerating' is assigned but never used
```

### Found in `app/routes/app.studio.old.tsx`:
```
✖ 4 errors:
  - 'useEffect' is defined but never used
  - 'shop' is assigned but never used
  - 'navigate' is assigned but never used
  - 'isGenerating' is assigned but never used
```

---

## Quick Fix for Current Errors

### Option 1: Auto-fix with ESLint
```bash
cd /d/Trayve_Production/trayve-app
npx eslint . --fix
```

### Option 2: Disable unused var warnings (temporary)
Add this to the top of problematic files:
```tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
```

### Option 3: Use variables or remove them
The best approach - either:
- Use the variables in your code
- Remove them if not needed
- Prefix with `_` to indicate intentionally unused: `_shop`, `_setSelectedModel`

---

## Recommended Workflow

1. **Check errors:**
   ```bash
   npm run lint
   ```

2. **Auto-fix what's possible:**
   ```bash
   npx eslint . --fix
   ```

3. **Check TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

4. **Test build:**
   ```bash
   npm run build
   ```

5. **Run dev server:**
   ```bash
   npm run dev
   ```

---

## VS Code Integration

If you're using VS Code, install these extensions for automatic error detection:
- **ESLint** - `dbaeumer.vscode-eslint`
- **Prettier** - `esbenp.prettier-vscode`

Errors will show up automatically as you type!

---

## Current Status

✅ **No blocking syntax errors** - Your app compiles  
⚠️ **8 linting warnings** - Unused variables (non-critical)  
💡 **Recommendation**: Run `npx eslint . --fix` to auto-fix

---

**Created on**: October 28, 2025  
**App Status**: Running, minor linting warnings only
