# Setup Guide for Theia IDE

This guide will help you set up and run the Theia IDE after cloning the repository.

## Why Do I Need This?

Git doesn't include built files (`node_modules`, `lib/`, bundled apps) to keep the repository small. After cloning, you need to install dependencies and build the application.

## Prerequisites

- **Node.js**: >= 18
- **npm**: >= 8

Check your versions:
```bash
node --version
npm --version
```

## Quick Start

Run these commands from the project root (`Editor/`):

```bash
# 1. Install all dependencies (this may take a few minutes)
npm install

# 2. Build all packages
npm run prepare

# 3. Build the browser application
npm run build:browser

# 4. Start the IDE
npm run start:browser
```

The IDE will be available at: **http://localhost:3000**

### Quick Start (Electron Desktop App)

```bash
# 1. Install all dependencies
npm install

# 2. Build the Electron application
npm run build:electron

# 3. Start the Electron app
npm run start:electron
```

The Electron desktop app will launch automatically.


---

## Detailed Setup Steps

### Step 1: Install Dependencies

```bash
npm install
```

This installs dependencies for all workspaces:
- `hello-world/` - Your custom extension
- `browser-app/` - The browser-based IDE
- `electron-app/` - The desktop IDE (optional)

### Step 2: Build Extensions

```bash
npm run prepare
```

This compiles TypeScript to JavaScript for all extensions. You'll see output like:
```
> hello-world@0.0.0 prepare
> npm run clean && npm run build
```

### Step 3: Bundle the Application

**For Browser Version:**
```bash
npm run build:browser
```

**For Electron Version (optional):**
```bash
npm run build:electron
```

This creates webpack bundles and processes plugins. It takes 10-30 seconds.

### Step 4: Run the IDE

**Browser Version:**
```bash
npm run start:browser
```
Then open: http://localhost:3000

**Electron Version:**
```bash
npm run start:electron
```

---

## Verifying Plugins Loaded

After starting the IDE:

1. **Click the settings icon** (bottom left) or press `Ctrl+,` (or `Cmd+,` on Mac)
2. **Search for "Color Theme"**
3. You should see:
   - ✅ Calm Dark
   - ✅ Community Material Theme (multiple variants)
4. **Search for "File Icon Theme"**
5. You should see:
   - ✅ Material Icon Theme

If plugins are missing, rebuild:
```bash
cd browser-app
npm run bundle
```

---

## Development Workflows

### Watch Mode (Auto-rebuild on changes)

```bash
npm run watch:browser
```

This watches for file changes and rebuilds automatically.

### Clean Build

If you encounter issues:

```bash
# Clean everything
rm -rf node_modules */node_modules
rm -rf lib */lib
rm -rf browser-app/src-gen browser-app/lib

# Reinstall and rebuild
npm install
npm run prepare
npm run build:browser
```

---

## Troubleshooting

### Problem: "Cannot find module" errors
**Solution:** Run `npm install` again

### Problem: Plugins not appearing
**Solution:** 
1. Check `browser-app/package.json` has correct plugin paths
2. Run `cd browser-app && npm run bundle`
3. Restart the server

### Problem: Build fails with TypeScript errors
**Solution:**
1. Ensure you have TypeScript installed: `npm list typescript`
2. Run `npm run prepare` to compile TypeScript

### Problem: Port 3000 already in use
**Solution:** 
- Kill the existing process: `pkill -f "theia start"`
- Or use a different port: `theia start --port=3001`

---

## Project Structure

```
Editor/
├── hello-world/          # Custom Theia extension
├── browser-app/          # Browser IDE configuration
├── electron-app/         # Desktop IDE configuration
├── plugins/              # VS Code plugins (themes, icons)
│   ├── calm-theme/
│   ├── material-icon-theme/
│   └── material-theme/
├── package.json          # Root package (Lerna workspaces)
└── SETUP.md             # This file
```

---

## Need Help?

- Check the [Theia Documentation](https://theia-ide.org/docs/)
- Review build logs for specific error messages
- Ensure you're using Node >= 18 and npm >= 8
