import { HelloWorldCommandContribution, HelloWorldMenuContribution } from './hello-world-contribution';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';

const glassStyles = `
/* Glass UI - Calm Dark Theme Enhancement */

:root {
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: blur(10px);
}

/* Background for the entire application */
body {
  background: radial-gradient(circle at 10% 20%, #1a1f2c 0%, #0F111A 40%, #050505 100%);
  background-attachment: fixed;
  background-size: cover;
}

/* Make the main shell transparent to reveal the body background */
.theia-app-shell {
  background-color: transparent !important;
}

/* Glass effect for Sidebar */
.theia-SideBar,
.theia-nav-container,
#theia-left-content-panel {
  background-color: rgba(9, 11, 16, 0.6) !important; /* Semi-transparent version of theme bg */
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-right: var(--glass-border) !important;
}

/* Glass effect for Panels */
.theia-Panel,
.theia-bottom-content-panel {
  background-color: rgba(9, 11, 16, 0.6) !important;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-top: var(--glass-border) !important;
}

/* Glass effect for Activity Bar */
.theia-ActivityBar {
  background-color: rgba(9, 11, 16, 0.5) !important;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-right: var(--glass-border) !important;
}

/* Editor Groups (Background of files) */
.theia-editor-container {
  background-color:  rgba(15, 17, 26, 0.65) !important; /* Slightly more opaque for code readability */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

/* Tabs */
.p-TabBar {
  background-color: transparent !important;
}

.p-TabBar .p-TabBar-tab {
  background-color: transparent !important;
  border: none !important;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.p-TabBar .p-TabBar-tab.p-mod-current {
  background-color: rgba(255, 255, 255, 0.05) !important;
  opacity: 1;
  border-top: 2px solid #A3E635 !important; /* Green accent from theme */
}

/* Context Menus and Dropdowns */
.theia-Menu, .p-Menu {
  background-color: rgba(15, 17, 26, 0.9) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: var(--glass-border) !important;
  box-shadow: var(--glass-shadow);
  border-radius: 8px;
}

.p-Menu-item.p-mod-active {
  background-color: rgba(163, 230, 53, 0.2) !important; /* Green accent hover */
}

/* Dialogs */
.theia-dialog {
  background-color: rgba(15, 17, 26, 0.85) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-radius: 12px;
  border: var(--glass-border);
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

/* Scrollbars - Sleek */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  background-color: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

::-webkit-scrollbar-corner {
  background-color: transparent;
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
  }
}

export default new ContainerModule(bind => {
  // Inject glass UI styles
  injectGlassStyles();

  // add your contribution bindings here
  bind(CommandContribution).to(HelloWorldCommandContribution);
  bind(MenuContribution).to(HelloWorldMenuContribution);
});
