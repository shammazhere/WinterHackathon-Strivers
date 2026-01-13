import { HelloWorldCommandContribution, HelloWorldMenuContribution } from './hello-world-contribution';
import { LOGO_BASE64 } from './logo-data';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';

const glassStyles = `
/* Glass UI - Precise Calm Dark Theme Alignment */

:root {
  /* Core Theme Colors from Calm Dark */
  --calm-bg-darker: #090B10;
  --calm-bg-main: #0F111A;
  --calm-accent: #A3E635;
  --calm-text: #d7dae0;
  --calm-text-dim: #676E95;
  
  /* Theia UI Variable Overrides */
  --theia-layout-color0: var(--calm-bg-darker) !important;
  --theia-layout-color1: var(--calm-bg-main) !important;
  --theia-layout-color2: #171b26 !important;
  --theia-layout-color3: #1c212d !important;
  
  --theia-accent-color0: var(--calm-accent) !important;
  --theia-accent-color1: #b4f14e !important;
  
  --theia-ui-font-color0: #ffffff !important;
  --theia-ui-font-color1: var(--calm-text) !important;
  --theia-ui-font-color2: var(--calm-text-dim) !important;
  
  --theia-border-color: rgba(255, 255, 255, 0.08) !important;

  /* Custom variables for glass effects - Aligned with theme opacities */
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: blur(10px);
}

/* Background for the entire application - Matches editor.background from theme */
body {
  background-color: var(--calm-bg-main) !important;
  background-image: none !important;
}

/* Make the main shell transparent to reveal the body background */
.theia-app-shell {
  background-color: transparent !important;
}

/* Glass effect for Sidebar - Matches activityBar.background opacity (50%) */
.theia-SideBar,
.theia-nav-container,
#theia-left-content-panel {
  background-color: rgba(9, 11, 16, 0.5) !important;
  backdrop-filter: var(--glass-blur) !important;
  -webkit-backdrop-filter: var(--glass-blur) !important;
  border-right: var(--glass-border) !important;
}

/* Glass effect for Panels - Matches panel.background opacity (50%) */
.theia-Panel,
.theia-bottom-content-panel {
  background-color: rgba(9, 11, 16, 0.5) !important;
  backdrop-filter: var(--glass-blur) !important;
  -webkit-backdrop-filter: var(--glass-blur) !important;
  border-top: var(--glass-border) !important;
}

/* Glass effect for Activity Bar - Matches activityBar.background opacity (50%) */
.theia-ActivityBar {
  background-color: rgba(9, 11, 16, 0.5) !important;
  backdrop-filter: var(--glass-blur) !important;
  -webkit-backdrop-filter: var(--glass-blur) !important;
  border-right: var(--glass-border) !important;
}

/* Editor Groups (Background of files) - Matches editor.background opacity (70%) */
.theia-editor-container {
  background-color: rgba(15, 17, 26, 0.7) !important;
  backdrop-filter: blur(5px) !important;
  -webkit-backdrop-filter: blur(5px) !important;
}

/* Status Bar Alignment - Matches statusBar.background opacity (60%) */
.theia-StatusBar {
  background-color: rgba(9, 11, 16, 0.6) !important;
  backdrop-filter: blur(5px) !important;
  color: var(--calm-text-dim) !important;
  border-top: var(--glass-border) !important;
}

/* Tabs Styling - Clean & Matches tab opacities */
.p-TabBar {
  background-color: transparent !important;
  min-height: 36px !important;
}

.p-TabBar .p-TabBar-tab {
  background-color: rgba(9, 11, 16, 0.3) !important; /* Matches tab.inactiveBackground */
  border: none !important;
  opacity: 0.8;
  margin-right: 2px !important;
  border-radius: 6px 6px 0 0 !important;
  transition: all 0.2s ease !important;
  color: var(--calm-text-dim) !important;
}

.p-TabBar .p-TabBar-tab.p-mod-current {
  background-color: rgba(15, 17, 26, 0.6) !important; /* Matches tab.activeBackground */
  opacity: 1;
  color: #ffffff !important;
  border-top: 2px solid var(--calm-accent) !important;
}

.p-TabBar .p-TabBar-tab:hover:not(.p-mod-current) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

/* Context Menus and Dropdowns */
.theia-Menu, .p-Menu {
  background-color: rgba(15, 17, 26, 0.9) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border: var(--glass-border) !important;
  box-shadow: var(--glass-shadow) !important;
}

.p-Menu-item.p-mod-active {
  background-color: rgba(163, 230, 53, 0.3) !important; /* Brighter accent for menus */
}

/* Dialogs */
.theia-dialog {
  background-color: rgba(15, 17, 26, 0.9) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-radius: 8px !important;
  border: var(--glass-border) !important;
}

/* Scrollbars - Minimalist */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background-color: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--calm-accent);
}

::-webkit-scrollbar-corner {
  background-color: transparent;
}
`;

const splashStyles = `
/* Splash Screen Styles */
#app-splash {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: var(--theia-layout-color1, #0F111A);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: opacity 0.8s ease-out, visibility 0.8s;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

#app-splash.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.splash-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeUp 0.8s ease-out;
}

.splash-logo {
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
  object-fit: contain;
  /* High contrast to force background to pure white/black before inverting, removing artifacts */
  filter: contrast(200%) invert(1);
  mix-blend-mode: screen; 
  animation: pulse 3s infinite ease-in-out;
}

.splash-title {
  font-size: 42px;
  font-weight: 700;
  letter-spacing: -1px;
  margin: 0 0 16px 0;
  background: linear-gradient(135deg, #ffffff 0%, #d7dae0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.splash-subtitle {
  font-size: 16px;
  color: #676E95;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

function injectGlassStyles() {
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = glassStyles;
    document.head.appendChild(style);

    // Inject Lenis Scroll
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@studio-freight/lenis@1.0.42/dist/lenis.min.js';
    script.onload = () => {
      // @ts-ignore
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
      });

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);
      console.log('Lenis Scroll Initialized');
    };
    document.head.appendChild(script);
    document.head.appendChild(script);
  }
}

function injectSplashScreen() {
  if (typeof document !== 'undefined') {
    // Inject Styles
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = splashStyles;
    document.head.appendChild(style);

    // Create Splash Element
    const splash = document.createElement('div');
    splash.id = 'app-splash';
    splash.innerHTML = `
      <div class="splash-content">
        <img src="${LOGO_BASE64}" class="splash-logo" alt="Visual Flow Logo" />
        <h1 class="splash-title">Visual Flow</h1>
        <div class="splash-subtitle">Editor</div>
      </div>
    `;
    document.body.appendChild(splash);

    // Remove splash after delay
    setTimeout(() => {
      splash.classList.add('hidden');
      setTimeout(() => {
        splash.remove();
      }, 1000); // Wait for transition
    }, 3000); // Display time

    // Inject Watermark (Background Logo)
    const watermark = document.createElement('div');
    watermark.id = 'app-watermark';
    watermark.style.cssText = `
      position: fixed;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      height: 400px;
      background-image: url('${LOGO_BASE64}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.05; 
      pointer-events: none;
      z-index: 0;
      /* High contrast to force background to pure white/black before inverting, removing artifacts */
      filter: contrast(200%) invert(1);
      mix-blend-mode: screen;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(watermark);

    // Watch for open files to hide watermark
    const checkEmptyState = () => {
      // If there are tabs or visible editor containers, hide the watermark
      const hasTabs = document.querySelectorAll('.p-TabBar-tab').length > 0;
      const hasEditors = document.querySelectorAll('.monaco-editor').length > 0;

      if (hasTabs || hasEditors) {
        watermark.style.opacity = '0';
      } else {
        watermark.style.opacity = '0.05';
      }
    };

    // Check periodically (MutationObserver is cleaner but polling covers all edge cases)
    setInterval(checkEmptyState, 500);
  }
}

export default new ContainerModule(bind => {
  // Inject glass UI styles
  injectGlassStyles();
  injectSplashScreen();

  // add your contribution bindings here
  bind(CommandContribution).to(HelloWorldCommandContribution);
  bind(MenuContribution).to(HelloWorldMenuContribution);
});
