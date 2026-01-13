import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { WhyFlowService, WhyFlowClient, WHYFLOW_SERVICE_PATH } from '../common/whyflow-protocol';
import { WhyFlowServiceImpl } from './whyflow-service';

export default new ContainerModule(bind => {
    bind(WhyFlowServiceImpl).toSelf().inSingletonScope();
    bind(WhyFlowService).toService(WhyFlowServiceImpl);

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler<WhyFlowClient>(
            WHYFLOW_SERVICE_PATH,
            client => {
                const service = ctx.container.get<WhyFlowServiceImpl>(WhyFlowServiceImpl);
                service.setClient(client);
                return service;
            }
        )
    ).inSingletonScope();
});
