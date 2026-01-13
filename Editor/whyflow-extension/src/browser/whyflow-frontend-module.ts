import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { WhyFlowWidget } from './whyflow-widget';
import { WhyFlowContribution } from './whyflow-contribution';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    WidgetFactory
} from '@theia/core/lib/browser';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging';
import { WhyFlowService, WHYFLOW_SERVICE_PATH } from '../common/whyflow-protocol';
import '../../src/browser/style/whyflow.css';

export default new ContainerModule((bind: interfaces.Bind) => {
    // Bind the widget
    bind(WhyFlowWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: WhyFlowWidget.ID,
        createWidget: () => ctx.container.get<WhyFlowWidget>(WhyFlowWidget)
    })).inSingletonScope();

    // Bind the contribution (commands, menus, view)
    bindViewContribution(bind, WhyFlowContribution);
    bind(FrontendApplicationContribution).toService(WhyFlowContribution);

    // Bind the backend service proxy
    bind(WhyFlowService).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        return connection.createProxy<WhyFlowService>(WHYFLOW_SERVICE_PATH);
    }).inSingletonScope();
});
