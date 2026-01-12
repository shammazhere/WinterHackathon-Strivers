---
description: How to set up the Theia IDE after cloning
---

# Setup Workflow

This workflow guides new developers through setting up the Theia IDE after cloning from git.

## Steps

1. **Install dependencies**
   ```bash
   npm install
   ```
   This installs dependencies for all workspaces (hello-world, browser-app, electron-app).

// turbo
2. **Build extensions**
   ```bash
   npm run prepare
   ```
   Compiles TypeScript to JavaScript for all extensions.

// turbo
3. **Bundle the browser application**
   ```bash
   npm run build:browser
   ```
   Creates webpack bundles and processes plugins.

// turbo
4. **Start the IDE**
   ```bash
   npm run start:browser
   ```
   Starts the Theia IDE on http://localhost:3000.

## Verification

After starting:
- Open http://localhost:3000
- Go to Settings (Ctrl+,)
- Check "Color Theme" - should see "Calm Dark" and "Community Material Theme" variants
- Check "File Icon Theme" - should see "Material Icon Theme"

## Troubleshooting

**Plugins not showing:**
```bash
cd browser-app
npm run bundle
npm start
```

**Clean build:**
```bash
rm -rf node_modules */node_modules lib */lib
npm install
npm run prepare
npm run build:browser
```
