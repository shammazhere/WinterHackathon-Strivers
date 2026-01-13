import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { CommonMenus, AbstractViewContribution, FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { WhyFlowWidget } from './whyflow-widget';

export const WhyFlowCommand: Command = {
    id: 'whyflow.open',
    label: 'WhyFlow: Open Visualizer'
};

export const WhyFlowToggleCommand: Command = {
    id: 'whyflow.toggle',
    label: 'Toggle WhyFlow Panel'
};

@injectable()
export class WhyFlowContribution extends AbstractViewContribution<WhyFlowWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: WhyFlowWidget.ID,
            widgetName: WhyFlowWidget.LABEL,
            defaultWidgetOptions: { area: 'right' },
            toggleCommandId: WhyFlowToggleCommand.id
        });
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        // Optionally open widget on startup
        // await this.openView({ activate: false });
    }

    registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);

        registry.registerCommand(WhyFlowCommand, {
            execute: () => this.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);

        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
            commandId: WhyFlowCommand.id,
            label: 'WhyFlow Visualizer'
        });
    }
}
