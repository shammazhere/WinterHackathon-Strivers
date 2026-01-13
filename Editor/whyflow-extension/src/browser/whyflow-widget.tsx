import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WhyFlowService, ProjectMap, ProjectNode, ProjectEdge } from '../common/whyflow-protocol';

@injectable()
export class WhyFlowWidget extends ReactWidget {

    static readonly ID = 'whyflow-widget';
    static readonly LABEL = 'WhyFlow Visualizer';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(WhyFlowService)
    protected readonly whyflowService!: WhyFlowService;

    protected projectMap: ProjectMap | null = null;
    protected isRunning: boolean = false;
    protected entryFile: string = 'server.js';
    protected inspectorPort: number = 9229;
    protected wsConnection: WebSocket | null = null;
    protected activeNodes: Set<string> = new Set();

    @postConstruct()
    protected init(): void {
        this.id = WhyFlowWidget.ID;
        this.title.label = WhyFlowWidget.LABEL;
        this.title.caption = WhyFlowWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-type-hierarchy';
        this.addClass('whyflow-widget');
        this.update();
    }

    protected render(): React.ReactNode {
        return (
            <div className="whyflow-container">
                {this.renderHeader()}
                {this.isRunning ? this.renderVisualization() : this.renderStartPanel()}
            </div>
        );
    }

    protected renderHeader(): React.ReactNode {
        return (
            <div className="whyflow-header">
                <h2>🌊 WhyFlow</h2>
                <span className={`status-badge ${this.isRunning ? 'active' : 'inactive'}`}>
                    {this.isRunning ? '● Live' : '○ Stopped'}
                </span>
            </div>
        );
    }

    protected renderStartPanel(): React.ReactNode {
        return (
            <div className="whyflow-start-panel">
                <div className="info-card">
                    <h3>Runtime Flow Visualizer</h3>
                    <p>Visualize your Node.js application's execution flow in real-time.</p>

                    <div className="form-group">
                        <label>Entry File:</label>
                        <input
                            type="text"
                            value={this.entryFile}
                            onChange={e => {
                                this.entryFile = e.target.value;
                                this.update();
                            }}
                            placeholder="server.js"
                        />
                    </div>

                    <div className="form-group">
                        <label>Inspector Port:</label>
                        <input
                            type="number"
                            value={this.inspectorPort}
                            onChange={e => {
                                this.inspectorPort = parseInt(e.target.value) || 9229;
                                this.update();
                            }}
                            placeholder="9229"
                        />
                    </div>

                    <div className="instructions">
                        <p><strong>Instructions:</strong></p>
                        <ol>
                            <li>Start your Node.js app with inspector:
                                <code>node --inspect={this.inspectorPort} {this.entryFile}</code>
                            </li>
                            <li>Click "Visualize" to connect</li>
                            <li>Make requests to your app to see the flow</li>
                        </ol>
                    </div>

                    <button
                        className="visualize-button"
                        onClick={() => this.startVisualization()}
                    >
                        🚀 Visualize
                    </button>
                </div>
            </div>
        );
    }

    protected renderVisualization(): React.ReactNode {
        return (
            <div className="whyflow-visualization">
                <div className="toolbar">
                    <button
                        className="stop-button"
                        onClick={() => this.stopVisualization()}
                    >
                        ■ Stop
                    </button>
                    <span className="node-count">
                        {this.projectMap?.nodes.length || 0} functions mapped
                    </span>
                </div>
                <div className="graph-container">
                    {this.renderGraph()}
                </div>
            </div>
        );
    }

    protected renderGraph(): React.ReactNode {
        if (!this.projectMap) {
            return <div className="loading">Loading project map...</div>;
        }

        const nodes = this.projectMap.nodes;
        const edges = this.projectMap.edges;
        console.warn('WhyFlow DEBUG RENDER:', {
            nodes: nodes.length,
            edges: edges.length,
            nodesContent: nodes,
            edgesContent: edges
        });

        // Simple grid layout for nodes
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const nodeWidth = 240;
        const nodeHeight = 140;
        const spacing = 40;

        return (
            <svg className="flow-graph" width="100%" height="100%">
                <defs>
                    <marker
                        id="arrowhead"
                        viewBox="0 -5 10 10"
                        refX="8"
                        refY="0"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="#30363d" />
                    </marker>
                </defs>

                <g className="edges">
                    {edges.map((edge, i) => {
                        const sourceIndex = nodes.findIndex(n => n.id === edge.from);
                        const targetIndex = nodes.findIndex(n => n.label === edge.to);
                        if (sourceIndex === -1 || targetIndex === -1) return null;

                        const sx = (sourceIndex % cols) * (nodeWidth + spacing) + nodeWidth / 2 + 50;
                        const sy = Math.floor(sourceIndex / cols) * (nodeHeight + spacing) + nodeHeight / 2 + 50;
                        const tx = (targetIndex % cols) * (nodeWidth + spacing) + nodeWidth / 2 + 50;
                        const ty = Math.floor(targetIndex / cols) * (nodeHeight + spacing) + nodeHeight / 2 + 50;

                        return (
                            <line
                                key={i}
                                x1={sx}
                                y1={sy}
                                x2={tx}
                                y2={ty}
                                className="edge-line"
                                markerEnd="url(#arrowhead)"
                            />
                        );
                    })}
                </g>

                <g className="nodes">
                    {nodes.map((node, i) => {
                        const x = (i % cols) * (nodeWidth + spacing) + 50;
                        const y = Math.floor(i / cols) * (nodeHeight + spacing) + 50;
                        const isActive = this.activeNodes.has(node.id);

                        return (
                            <g key={node.id} className={`node ${isActive ? 'active' : ''}`}>
                                <foreignObject x={x} y={y} width={nodeWidth} height={nodeHeight}>
                                    <div className={`code-card ${isActive ? 'active' : ''}`}>
                                        <div className="card-header">
                                            <span><span className="js-label">JS</span> {node.file}</span>
                                        </div>
                                        <pre>
                                            <code>
                                                <span className="keyword">function</span>{' '}
                                                <span className="fn-name">{node.label}</span>
                                                <span className="bracket">{'() {'}</span>
                                                {'\n  '}
                                                <span className="comment">// line {node.line}</span>
                                                {'\n'}
                                                <span className="bracket">{'}'}</span>
                                            </code>
                                        </pre>
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    })}
                </g>
            </svg>
        );
    }

    protected async startVisualization(): Promise<void> {
        try {
            const roots = this.workspaceService.tryGetRoots();
            if (roots.length === 0) {
                this.messageService.error('No workspace folder open');
                return;
            }

            const projectPath = roots[0].resource.path.toString();
            this.messageService.info(`Starting WhyFlow for: ${projectPath}`);

            // Start the backend engine
            const status = await this.whyflowService.startEngine(
                projectPath,
                this.entryFile,
                this.inspectorPort
            );

            if (status.isRunning) {
                this.isRunning = true;
                this.projectMap = await this.whyflowService.getProjectMap();

                // Connect to WebSocket for real-time updates
                this.connectWebSocket();

                this.update();
            }
        } catch (error) {
            this.messageService.error(`Failed to start WhyFlow: ${error}`);
        }
    }

    protected connectWebSocket(): void {
        try {
            this.wsConnection = new WebSocket('ws://localhost:8080');

            this.wsConnection.onopen = () => {
                console.log('WhyFlow: Connected to tracer');
            };

            this.wsConnection.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === 'INIT_MAP') {
                    this.projectMap = msg.data;
                    this.update();
                } else if (msg.type === 'CALL') {
                    this.triggerNodeAnimation(msg.nodeId);
                }
            };

            this.wsConnection.onerror = (error) => {
                console.error('WhyFlow WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }

    protected triggerNodeAnimation(nodeId: string): void {
        this.activeNodes.add(nodeId);
        this.update();

        setTimeout(() => {
            this.activeNodes.delete(nodeId);
            this.update();
        }, 800);
    }

    protected async stopVisualization(): Promise<void> {
        try {
            await this.whyflowService.stopEngine();

            if (this.wsConnection) {
                this.wsConnection.close();
                this.wsConnection = null;
            }

            this.isRunning = false;
            this.projectMap = null;
            this.activeNodes.clear();
            this.update();

            this.messageService.info('WhyFlow stopped');
        } catch (error) {
            this.messageService.error(`Failed to stop WhyFlow: ${error}`);
        }
    }

    dispose(): void {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        super.dispose();
    }
}
