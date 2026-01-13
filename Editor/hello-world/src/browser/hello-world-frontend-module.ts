import { HelloWorldCommandContribution, HelloWorldMenuContribution, HelloWorldKeybindingContribution } from './hello-world-contribution';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';
import { WhyFlowView, WhyFlowViewContribution } from './whyflow-view';
import { WidgetFactory, FrontendApplicationContribution, bindViewContribution, KeybindingContribution } from '@theia/core/lib/browser';

function injectGlassStyles() {
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --whyflow-accent: #A3E635;
            --whyflow-bg-primary: #0D1117;
            --whyflow-bg-secondary: #161B22;
            --whyflow-border: #30363D;
            --whyflow-text: #E6EDF3;
            --whyflow-text-muted: #7D8590;
        }

        .theia-layout-panel {
            background: var(--whyflow-bg-primary) !important;
        }

        .whyflow-view-widget {
            background: linear-gradient(135deg, var(--whyflow-bg-primary) 0%, var(--whyflow-bg-secondary) 100%);
        }

        .whyflow-failure-overlay {
            animation: whyflow-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes whyflow-slide-in {
            from {
                transform: translate(-50%, -50%) scale(0.9);
                opacity: 0;
            }
            to {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }

        @keyframes whyflow-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        @keyframes whyflow-glow {
            0%, 100% { box-shadow: 0 0 5px var(--whyflow-accent), 0 0 10px var(--whyflow-accent); }
            50% { box-shadow: 0 0 15px var(--whyflow-accent), 0 0 25px var(--whyflow-accent); }
        }

        .theia-TreeContainer {
            background: var(--whyflow-bg-primary) !important;
        }

        .theia-TreeNode:hover {
            background: rgba(163, 230, 53, 0.1) !important;
        }

        .theia-TreeNode.theia-mod-selected {
            background: rgba(163, 230, 53, 0.15) !important;
        }

        .theia-input {
            background: var(--whyflow-bg-primary) !important;
            border-color: var(--whyflow-border) !important;
        }

        .theia-input:focus {
            border-color: var(--whyflow-accent) !important;
            box-shadow: 0 0 0 2px rgba(163, 230, 53, 0.2) !important;
        }

        .theia-button {
            background: var(--whyflow-accent) !important;
            color: var(--whyflow-bg-primary) !important;
            border: none !important;
            border-radius: 6px !important;
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }

        .theia-button:hover {
            background: #B9EF5A !important;
            transform: translateY(-1px);
        }

        .theia-button.secondary {
            background: var(--whyflow-bg-secondary) !important;
            color: var(--whyflow-text) !important;
            border: 1px solid var(--whyflow-border) !important;
        }

        .theia-button.secondary:hover {
            background: #21262D !important;
            border-color: var(--whyflow-accent) !important;
        }

        .p-TabBar-tab {
            transition: all 0.2s ease !important;
        }

        .p-TabBar-tab.p-mod-current {
            border-top: 2px solid var(--whyflow-accent) !important;
        }

        .theia-scrollbar-rail {
            background: transparent !important;
        }

        .theia-scrollbar-thumb {
            background: rgba(230, 237, 243, 0.15) !important;
            border-radius: 4px !important;
        }

        .theia-scrollbar-thumb:hover {
            background: rgba(230, 237, 243, 0.25) !important;
        }

        .monaco-editor .cursors-layer .cursor {
            background: var(--whyflow-accent) !important;
            border-color: var(--whyflow-accent) !important;
        }

        .monaco-editor .line-numbers {
            color: var(--whyflow-text-muted) !important;
        }

        .monaco-editor .line-numbers.active-line-number {
            color: var(--whyflow-text) !important;
        }

        .monaco-editor .bracket-match {
            border: 1px solid var(--whyflow-accent) !important;
            background: rgba(163, 230, 53, 0.1) !important;
        }

        .monaco-editor .find-widget {
            background: var(--whyflow-bg-secondary) !important;
            border: 1px solid var(--whyflow-border) !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        }

        .monaco-editor .suggest-widget {
            background: var(--whyflow-bg-secondary) !important;
            border: 1px solid var(--whyflow-border) !important;
            border-radius: 8px !important;
        }

        .monaco-editor .suggest-widget .monaco-list-row.focused {
            background: rgba(163, 230, 53, 0.15) !important;
        }

        .monaco-editor .suggest-widget .monaco-list-row:hover {
            background: rgba(163, 230, 53, 0.1) !important;
        }

        .theia-notifications-container {
            border-radius: 12px !important;
            overflow: hidden !important;
        }

        .theia-notification-message {
            background: var(--whyflow-bg-secondary) !important;
            border: 1px solid var(--whyflow-border) !important;
        }

        .theia-notification-message.info {
            border-left: 4px solid #79C0FF !important;
        }

        .theia-notification-message.warning {
            border-left: 4px solid #D29922 !important;
        }

        .theia-notification-message.error {
            border-left: 4px solid #F85149 !important;
        }

        .theia-notification-message.success {
            border-left: 4px solid var(--whyflow-accent) !important;
        }

        .theia-quick-open-container {
            background: var(--whyflow-bg-secondary) !important;
            border: 1px solid var(--whyflow-border) !important;
            border-radius: 12px !important;
            box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5) !important;
        }

        .theia-menu {
            background: var(--whyflow-bg-secondary) !important;
            border: 1px solid var(--whyflow-border) !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        }

        .theia-menu-item:hover {
            background: rgba(163, 230, 53, 0.1) !important;
        }

        .theia-menubar > .theia-menu-bar-item:hover,
        .theia-menubar > .theia-menu-bar-item.theia-mod-open {
            background: rgba(163, 230, 53, 0.15) !important;
        }

        .p-Widget.p-DockPanel-widget {
            border: none !important;
        }

        .theia-side-panel .theia-sidepanel-toolbar {
            background: var(--whyflow-bg-primary) !important;
            border-bottom: 1px solid var(--whyflow-border) !important;
        }

        .theia-mod-active .theia-side-panel {
            border-color: var(--whyflow-accent) !important;
        }

        .theia-minimap {
            opacity: 0.6;
            transition: opacity 0.2s ease;
        }

        .theia-minimap:hover {
            opacity: 1;
        }

        .monaco-editor .margin-view-overlays .current-line {
            border: none !important;
        }

        .monaco-editor .view-overlays .current-line {
            background: rgba(255, 255, 255, 0.03) !important;
            border-left: 2px solid var(--whyflow-accent) !important;
        }

        kbd {
            background: var(--whyflow-bg-secondary);
            border: 1px solid var(--whyflow-border);
            border-radius: 4px;
            padding: 2px 6px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            font-size: 12px;
            color: var(--whyflow-text);
        }

        .theia-progress-bar {
            background: var(--whyflow-accent) !important;
        }

        .theia-badge {
            background: var(--whyflow-accent) !important;
            color: var(--whyflow-bg-primary) !important;
        }

        .theia-welcome-page-heading {
            color: var(--whyflow-accent) !important;
        }

        *::selection {
            background: rgba(163, 230, 53, 0.3) !important;
        }
    `;
    document.head.appendChild(style);
}

export default new ContainerModule(bind => {
    injectGlassStyles();

    bindViewContribution(bind, WhyFlowViewContribution);
    bind(FrontendApplicationContribution).toService(WhyFlowViewContribution);
    bind(WhyFlowView).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: WhyFlowView.ID,
        createWidget: () => ctx.container.get<WhyFlowView>(WhyFlowView)
    }));

    bind(CommandContribution).to(HelloWorldCommandContribution);
    bind(MenuContribution).to(HelloWorldMenuContribution);
    bind(KeybindingContribution).to(HelloWorldKeybindingContribution);
});
