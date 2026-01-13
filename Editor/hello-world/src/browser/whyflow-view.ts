import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message, AbstractViewContribution, Widget, StatefulWidget, LabelProvider } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileChangesEvent, FileChangeType } from '@theia/filesystem/lib/common/files';
import URI from '@theia/core/lib/common/uri';

interface GraphNode {
    id: string;
    name: string;
    file: string;
    line: number;
    docs?: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface TraceEntry {
    timestamp: number;
    id: string;
    name: string;
    file: string;
    line: number;
    status: 'START' | 'END' | 'FAIL';
    error?: string;
}

@injectable()
export class WhyFlowView extends BaseWidget implements StatefulWidget {

    public static readonly ID = 'whyflow-view';
    public static readonly LABEL = 'WhyFlow Diagram';

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    protected d3: typeof import('d3') | undefined;
    protected graphData: GraphData | undefined;
    protected container: HTMLElement | undefined;
    protected svg: any;
    protected simulation: any;
    protected nodeElements: any;
    protected linkElements: any;
    protected lastProcessedLine = 0;
    protected watcherInterval: NodeJS.Timeout | undefined;
    protected graphWatcherInterval: NodeJS.Timeout | undefined;
    protected lastGraphModified = 0;
    protected executionHistory: TraceEntry[] = [];
    protected infoPanel: any;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = WhyFlowView.ID;
        this.title.label = WhyFlowView.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-type-hierarchy';
        this.addClass('whyflow-view-widget');
        
        this.d3 = await import('d3');
        this.update();
        
        this.setupFileWatchers();
    }

    storeState(): object {
        return {};
    }

    restoreState(oldState: object): void {}

    protected setupFileWatchers(): void {
        this.graphWatcherInterval = setInterval(() => this.checkGraphUpdate(), 2000);
        this.watcherInterval = setInterval(() => this.processNewTraceEntries(), 500);
    }

    protected async checkGraphUpdate(): Promise<void> {
        const roots = this.workspaceService.tryGetRoots();
        if (!roots[0]) return;
        
        const workspaceUri = roots[0].resource.toString();
        const graphPath = new URI(workspaceUri + '/whyflow-data/graph.json');
        
        try {
            const stat = await this.fileService.resolve(graphPath);
            if (stat.mtime && stat.mtime > this.lastGraphModified) {
                this.lastGraphModified = stat.mtime;
                await this.reloadGraph();
            }
        } catch {}
    }

    protected async reloadGraph(): Promise<void> {
        const roots = this.workspaceService.tryGetRoots();
        if (!roots[0]) return;
        
        const workspaceUri = roots[0].resource.toString();
        const graphPath = new URI(workspaceUri + '/whyflow-data/graph.json');
        
        try {
            const content = await this.fileService.read(graphPath);
            const newData = JSON.parse(content.value) as GraphData;
            
            if (this.graphData && this.simulation && this.d3) {
                this.mergeGraphData(newData);
            } else {
                this.graphData = newData;
                this.renderDiagram();
            }
        } catch {}
    }

    protected mergeGraphData(newData: GraphData): void {
        if (!this.graphData || !this.d3 || !this.simulation) return;
        
        const existingIds = new Set(this.graphData.nodes.map(n => n.id));
        const newNodes = newData.nodes.filter(n => !existingIds.has(n.id));
        
        newNodes.forEach(node => {
            this.graphData!.nodes.push(node);
        });
        
        const existingLinks = new Set(this.graphData.links.map(l => 
            `${typeof l.source === 'string' ? l.source : l.source.id}-${typeof l.target === 'string' ? l.target : l.target.id}`
        ));
        
        newData.links.forEach(link => {
            const linkId = `${typeof link.source === 'string' ? link.source : link.source.id}-${typeof link.target === 'string' ? link.target : link.target.id}`;
            if (!existingLinks.has(linkId)) {
                this.graphData!.links.push(link);
            }
        });
        
        if (newNodes.length > 0 || newData.links.length > this.graphData.links.length) {
            this.updateGraph();
        }
    }

    protected updateGraph(): void {
        if (!this.d3 || !this.graphData || !this.simulation || !this.container) return;
        const d3 = this.d3;
        
        const g = d3.select(this.container).select('g');
        
        this.linkElements = g.select('.links')
            .selectAll('line')
            .data(this.graphData.links, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}`);
        
        this.linkElements.exit().remove();
        
        const newLinks = this.linkElements.enter()
            .append('line')
            .attr('stroke', 'rgba(163, 230, 53, 0.3)')
            .attr('stroke-width', 2)
            .style('opacity', 0)
            .transition()
            .duration(500)
            .style('opacity', 1);
        
        this.linkElements = newLinks.merge(this.linkElements);
        
        this.nodeElements = g.select('.nodes')
            .selectAll('g.node')
            .data(this.graphData.nodes, (d: any) => d.id);
        
        this.nodeElements.exit().remove();
        
        const newNodeGroups = this.nodeElements.enter()
            .append('g')
            .attr('class', 'node')
            .style('cursor', 'pointer')
            .call(d3.drag<SVGGElement, GraphNode>()
                .on('start', this.dragStarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragEnded.bind(this)));
        
        newNodeGroups.append('circle')
            .attr('r', 0)
            .attr('fill', '#A3E635')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('filter', 'url(#glow)')
            .transition()
            .duration(500)
            .attr('r', 14);
        
        newNodeGroups.append('text')
            .attr('dy', 30)
            .attr('text-anchor', 'middle')
            .attr('fill', '#E6EDF3')
            .attr('font-size', '11px')
            .attr('font-family', 'system-ui, -apple-system, sans-serif')
            .text((d: GraphNode) => d.name.length > 15 ? d.name.slice(0, 15) + '...' : d.name)
            .style('opacity', 0)
            .transition()
            .duration(500)
            .style('opacity', 1);
        
        newNodeGroups.on('click', (_event: MouseEvent, d: GraphNode) => this.showNodeInfo(d));
        
        this.nodeElements = newNodeGroups.merge(this.nodeElements);
        
        this.simulation.nodes(this.graphData.nodes);
        (this.simulation.force('link') as any).links(this.graphData.links);
        this.simulation.alpha(0.3).restart();
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.renderDiagram();
    }

    protected async renderDiagram(): Promise<void> {
        this.node.innerHTML = '';
        
        this.container = document.createElement('div');
        this.container.id = 'whyflow-container';
        this.container.style.cssText = 'width:100%; height:100%; background: linear-gradient(135deg, #0D1117 0%, #161B22 100%); position: relative; overflow: hidden;';
        this.node.appendChild(this.container);
        
        this.createToolbar();
        this.createInfoPanel();
        this.createLegend();
        
        const roots = this.workspaceService.tryGetRoots();
        const workspace = roots[0];
        if (!workspace) {
            this.showEmptyState('Open a workspace to view the flow diagram');
            return;
        }

        const workspaceUri = workspace.resource.toString();

        try {
            const graphPath = new URI(workspaceUri + '/whyflow-data/graph.json');
            const graphContent = await this.fileService.read(graphPath);
            this.graphData = JSON.parse(graphContent.value);
            
            if (!this.graphData || this.graphData.nodes.length === 0) {
                this.showEmptyState('No function calls traced yet. Press F5 to run with tracing.');
                return;
            }

            this.drawGraph();
            this.lastProcessedLine = 0;
            this.processNewTraceEntries();
        } catch (e) {
            this.showEmptyState('No trace data found. Use View → WhyFlow: Run with Trace or press F5');
        }
    }

    protected createToolbar(): void {
        if (!this.container) return;
        
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            position: absolute; top: 15px; left: 15px; z-index: 100;
            display: flex; gap: 8px;
        `;
        
        const buttons = [
            { icon: '⟳', title: 'Refresh', action: () => this.renderDiagram() },
            { icon: '⊕', title: 'Zoom In', action: () => this.zoom(1.2) },
            { icon: '⊖', title: 'Zoom Out', action: () => this.zoom(0.8) },
            { icon: '⊙', title: 'Reset View', action: () => this.resetView() },
        ];
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.innerHTML = btn.icon;
            button.title = btn.title;
            button.style.cssText = `
                width: 36px; height: 36px;
                background: rgba(33, 38, 45, 0.9);
                border: 1px solid rgba(48, 54, 61, 0.8);
                border-radius: 8px;
                color: #E6EDF3;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
            `;
            button.onmouseenter = () => {
                button.style.background = 'rgba(163, 230, 53, 0.2)';
                button.style.borderColor = '#A3E635';
            };
            button.onmouseleave = () => {
                button.style.background = 'rgba(33, 38, 45, 0.9)';
                button.style.borderColor = 'rgba(48, 54, 61, 0.8)';
            };
            button.onclick = btn.action;
            toolbar.appendChild(button);
        });
        
        this.container.appendChild(toolbar);
    }

    protected createInfoPanel(): void {
        if (!this.container || !this.d3) return;
        
        const panel = document.createElement('div');
        panel.id = 'whyflow-info-panel';
        panel.style.cssText = `
            position: absolute; top: 15px; right: 15px; width: 280px;
            background: rgba(22, 27, 34, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(48, 54, 61, 0.8);
            border-radius: 12px;
            padding: 0;
            color: #E6EDF3;
            display: none;
            z-index: 100;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            overflow: hidden;
        `;
        this.container.appendChild(panel);
        this.infoPanel = panel;
    }

    protected createLegend(): void {
        if (!this.container) return;
        
        const legend = document.createElement('div');
        legend.style.cssText = `
            position: absolute; bottom: 15px; left: 15px;
            background: rgba(22, 27, 34, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(48, 54, 61, 0.8);
            border-radius: 10px;
            padding: 12px 16px;
            color: #E6EDF3;
            font-size: 12px;
            z-index: 100;
        `;
        legend.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; color: #A3E635;">Status Legend</div>
            <div style="display: flex; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: #A3E635; display: inline-block;"></span>
                    <span>Completed</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: #FBBF24; display: inline-block;"></span>
                    <span>Running</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: #EF4444; display: inline-block;"></span>
                    <span>Failed</span>
                </div>
            </div>
        `;
        this.container.appendChild(legend);
    }

    protected showEmptyState(message: string): void {
        if (!this.container) return;
        
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #7D8590;
        `;
        emptyState.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">🔍</div>
            <div style="font-size: 18px; font-weight: 500; color: #E6EDF3; margin-bottom: 10px;">No Flow Data</div>
            <div style="font-size: 14px; max-width: 300px; line-height: 1.5;">${message}</div>
            <div style="margin-top: 20px;">
                <kbd style="padding: 4px 8px; background: #21262D; border: 1px solid #30363D; border-radius: 4px; font-family: monospace;">F5</kbd>
                <span style="margin: 0 8px;">to run with trace</span>
            </div>
        `;
        this.container.appendChild(emptyState);
    }

    protected showNodeInfo(node: GraphNode): void {
        if (!this.infoPanel) return;
        
        const history = this.executionHistory.filter(e => e.id === node.id);
        const lastExecution = history[history.length - 1];
        const executionCount = history.filter(e => e.status === 'START').length;
        const failCount = history.filter(e => e.status === 'FAIL').length;
        
        this.infoPanel.style.display = 'block';
        this.infoPanel.innerHTML = `
            <div style="background: linear-gradient(135deg, #A3E635 0%, #84CC16 100%); padding: 16px; color: #0D1117;">
                <div style="font-size: 16px; font-weight: 600;">${node.name}</div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${node.file}:${node.line}</div>
            </div>
            <div style="padding: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div style="background: rgba(33, 38, 45, 0.8); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: #A3E635;">${executionCount}</div>
                        <div style="font-size: 11px; color: #7D8590; margin-top: 4px;">Executions</div>
                    </div>
                    <div style="background: rgba(33, 38, 45, 0.8); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: ${failCount > 0 ? '#EF4444' : '#A3E635'};">${failCount}</div>
                        <div style="font-size: 11px; color: #7D8590; margin-top: 4px;">Failures</div>
                    </div>
                </div>
                ${lastExecution ? `
                <div style="border-top: 1px solid rgba(48, 54, 61, 0.8); padding-top: 12px;">
                    <div style="font-size: 11px; color: #7D8590; margin-bottom: 8px;">Last Execution</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${lastExecution.status === 'END' ? '#A3E635' : lastExecution.status === 'FAIL' ? '#EF4444' : '#FBBF24'};"></span>
                        <span style="font-size: 13px;">${lastExecution.status}</span>
                        <span style="font-size: 11px; color: #7D8590; margin-left: auto;">${new Date(lastExecution.timestamp).toLocaleTimeString()}</span>
                    </div>
                    ${lastExecution.error ? `<div style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; font-size: 12px; color: #EF4444;">${lastExecution.error}</div>` : ''}
                </div>
                ` : ''}
                ${node.docs ? `<div style="margin-top: 12px; font-size: 13px; color: #7D8590; line-height: 1.5;">${node.docs}</div>` : ''}
            </div>
            <button id="close-info" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #0D1117; font-size: 18px; cursor: pointer; opacity: 0.7;">×</button>
        `;
        
        const closeBtn = this.infoPanel.querySelector('#close-info');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.infoPanel.style.display = 'none';
            });
        }
    }

    protected drawGraph(): void {
        if (!this.d3 || !this.graphData || !this.container) return;
        const d3 = this.d3;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const svg = d3.select(this.container).append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0');

        const defs = svg.append('defs');
        
        const filter = defs.append('filter')
            .attr('id', 'glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');
        
        filter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');
        
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        const gradient = defs.append('linearGradient')
            .attr('id', 'link-gradient')
            .attr('gradientUnits', 'userSpaceOnUse');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', '#A3E635').attr('stop-opacity', '0.6');
        gradient.append('stop').attr('offset', '100%').attr('stop-color', '#84CC16').attr('stop-opacity', '0.3');

        const g = svg.append('g');
        this.svg = svg;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                g.attr('transform', event.transform.toString());
            });

        svg.call(zoom);

        this.simulation = d3.forceSimulation(this.graphData.nodes)
            .force('link', d3.forceLink(this.graphData.links).id((d: any) => d.id).distance(120).strength(0.5))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(40));

        const linksGroup = g.append('g').attr('class', 'links');
        const nodesGroup = g.append('g').attr('class', 'nodes');

        this.linkElements = linksGroup.selectAll('line')
            .data(this.graphData.links)
            .enter().append('line')
            .attr('stroke', 'rgba(163, 230, 53, 0.3)')
            .attr('stroke-width', 2);

        this.nodeElements = nodesGroup.selectAll('g.node')
            .data(this.graphData.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .style('cursor', 'pointer')
            .call(d3.drag<SVGGElement, GraphNode>()
                .on('start', this.dragStarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragEnded.bind(this)));

        this.nodeElements.append('circle')
            .attr('r', 14)
            .attr('fill', '#A3E635')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('filter', 'url(#glow)');

        this.nodeElements.append('text')
            .attr('dy', 30)
            .attr('text-anchor', 'middle')
            .attr('fill', '#E6EDF3')
            .attr('font-size', '11px')
            .attr('font-family', 'system-ui, -apple-system, sans-serif')
            .attr('pointer-events', 'none')
            .text((d: GraphNode) => d.name.length > 15 ? d.name.slice(0, 15) + '...' : d.name);

        this.nodeElements.on('click', (_event: MouseEvent, d: GraphNode) => this.showNodeInfo(d));

        this.simulation.on('tick', () => {
            this.linkElements
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            this.nodeElements.attr('transform', (d: GraphNode) => `translate(${d.x},${d.y})`);
        });
    }

    protected dragStarted(event: any, d: GraphNode): void {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    protected dragged(event: any, d: GraphNode): void {
        d.fx = event.x;
        d.fy = event.y;
    }

    protected dragEnded(event: any, d: GraphNode): void {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
    }

    protected zoom(factor: number): void {
        if (!this.svg || !this.d3) return;
        const d3 = this.d3;
        
        this.svg.transition().duration(300).call(
            (d3.zoom() as any).scaleBy,
            factor
        );
    }

    protected resetView(): void {
        if (!this.svg || !this.d3 || !this.container) return;
        const d3 = this.d3;
        
        this.svg.transition().duration(500).call(
            (d3.zoom() as any).transform,
            d3.zoomIdentity.translate(this.container.clientWidth / 2, this.container.clientHeight / 2).scale(1)
        );
    }

    protected async processNewTraceEntries(): Promise<void> {
        const roots = this.workspaceService.tryGetRoots();
        if (!roots[0]) return;
        
        const workspaceUri = roots[0].resource.toString();
        const logPath = new URI(workspaceUri + '/whyflow-trace.log');
        
        try {
            const content = await this.fileService.read(logPath);
            const lines = content.value.split('\n').filter((l: string) => l.trim());
            
            const newLines = lines.slice(this.lastProcessedLine);
            this.lastProcessedLine = lines.length;
            
            newLines.forEach((line: string) => {
                try {
                    const entry = JSON.parse(line) as TraceEntry;
                    this.executionHistory.push(entry);
                    this.highlightNode(entry);
                } catch {}
            });
        } catch {}
    }

    protected highlightNode(entry: TraceEntry): void {
        if (!this.d3 || !this.nodeElements) return;
        const d3 = this.d3;
        
        const node = this.nodeElements.filter((d: GraphNode) => d.id === entry.id);
        if (node.empty()) return;
        
        const circle = node.select('circle');
        
        if (entry.status === 'START') {
            circle.transition()
                .duration(200)
                .attr('fill', '#FBBF24')
                .attr('r', 18);
        } else if (entry.status === 'END') {
            circle.transition()
                .duration(400)
                .attr('fill', '#A3E635')
                .attr('r', 14);
        } else if (entry.status === 'FAIL') {
            circle.transition()
                .duration(200)
                .attr('fill', '#EF4444')
                .attr('r', 20);
            
            this.showFailureOverlay(entry);
        }
    }

    protected showFailureOverlay(entry: TraceEntry): void {
        if (!this.d3 || !this.container) return;
        const d3 = this.d3;
        
        d3.selectAll('.whyflow-failure-overlay').remove();
        
        const overlay = d3.select(this.container).append('div')
            .attr('class', 'whyflow-failure-overlay')
            .style('position', 'absolute')
            .style('top', '50%')
            .style('left', '50%')
            .style('transform', 'translate(-50%, -50%) scale(0.9)')
            .style('opacity', '0')
            .style('width', '400px')
            .style('background', 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)')
            .style('backdrop-filter', 'blur(20px)')
            .style('padding', '24px')
            .style('border-radius', '16px')
            .style('color', 'white')
            .style('text-align', 'center')
            .style('box-shadow', '0 25px 50px -12px rgba(239, 68, 68, 0.5)')
            .style('z-index', '1000')
            .style('border', '1px solid rgba(255, 255, 255, 0.2)');

        overlay.html(`
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">Execution Failed</h2>
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">${entry.name} at ${entry.file}:${entry.line}</p>
            ${entry.error ? `<div style="margin: 16px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; font-family: monospace; font-size: 13px; text-align: left; word-break: break-word;">${entry.error}</div>` : ''}
            <button id="dismiss-failure" style="
                margin-top: 16px; padding: 10px 24px;
                background: white; color: #DC2626;
                border: none; border-radius: 8px;
                font-weight: 600; font-size: 14px;
                cursor: pointer; transition: all 0.2s;
            ">Dismiss</button>
        `);

        overlay.transition()
            .duration(300)
            .style('opacity', '1')
            .style('transform', 'translate(-50%, -50%) scale(1)');

        const dismissBtn = document.getElementById('dismiss-failure');
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                overlay.transition()
                    .duration(200)
                    .style('opacity', '0')
                    .style('transform', 'translate(-50%, -50%) scale(0.9)')
                    .remove();
            };
        }
    }

    dispose(): void {
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
        }
        if (this.graphWatcherInterval) {
            clearInterval(this.graphWatcherInterval);
        }
        super.dispose();
    }
}

@injectable()
export class WhyFlowViewContribution extends AbstractViewContribution<WhyFlowView> {
    constructor() {
        super({
            widgetId: WhyFlowView.ID,
            widgetName: WhyFlowView.LABEL,
            defaultWidgetOptions: { area: 'main' },
            toggleCommandId: 'whyflow-view:toggle'
        });
    }
}
