import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as http from 'http';
import { ChildProcess, spawn } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { Project, SyntaxKind, FunctionDeclaration, ArrowFunction } from 'ts-morph';
import {
    WhyFlowService,
    WhyFlowClient,
    WhyFlowStatus,
    ProjectMap,
    ProjectNode,
    ProjectEdge
} from '../common/whyflow-protocol';

@injectable()
export class WhyFlowServiceImpl implements WhyFlowService {
    protected client: WhyFlowClient | undefined;
    protected projectMap: ProjectMap | null = null;
    protected nodeProcess: ChildProcess | null = null;
    protected wss: WebSocketServer | null = null;
    protected watcherInterval: NodeJS.Timeout | null = null;
    protected watcherWs: WebSocket | null = null;
    protected currentStatus: WhyFlowStatus = { isRunning: false };

    setClient(client: WhyFlowClient | undefined): void {
        this.client = client;
    }

    dispose(): void {
        this.stopEngine();
    }

    async startEngine(projectPath: string, entryFile: string, inspectorPort: number = 9229): Promise<WhyFlowStatus> {
        try {
            // Stop any existing engine
            await this.stopEngine();

            const absolutePath = path.resolve(projectPath);
            console.log(`🔍 WhyFlow: Mapping project at: ${absolutePath}`);

            // 1. Static Analysis - Generate project map
            this.projectMap = this.generateProjectMap(absolutePath);
            console.log(`📊 WhyFlow: ${this.projectMap.nodes.length} functions found`);

            // 2. Start WebSocket server for frontend communication
            const tracerPort = 8080;
            this.wss = new WebSocketServer({ port: tracerPort });

            this.wss.on('connection', (ws) => {
                console.log('🔗 WhyFlow: Frontend connected');
                if (this.projectMap) {
                    ws.send(JSON.stringify({
                        type: 'INIT_MAP',
                        data: this.projectMap
                    }));
                }
            });

            console.log(`📡 WhyFlow: Tracer server started on ws://localhost:${tracerPort}`);

            // 3. Wait a moment, then connect to the inspector
            setTimeout(() => {
                this.connectToInspector(absolutePath, inspectorPort);
            }, 1000);

            this.currentStatus = {
                isRunning: true,
                projectPath: absolutePath,
                nodeCount: this.projectMap.nodes.length,
                tracerPort,
                inspectorPort
            };

            this.client?.onStatusChange(this.currentStatus);
            return this.currentStatus;

        } catch (error) {
            console.error('❌ WhyFlow: Failed to start engine:', error);
            throw error;
        }
    }

    async stopEngine(): Promise<void> {
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = null;
        }

        if (this.watcherWs) {
            this.watcherWs.close();
            this.watcherWs = null;
        }

        if (this.nodeProcess) {
            this.nodeProcess.kill();
            this.nodeProcess = null;
        }

        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        this.projectMap = null;
        this.currentStatus = { isRunning: false };
        this.client?.onStatusChange(this.currentStatus);
    }

    async getStatus(): Promise<WhyFlowStatus> {
        return this.currentStatus;
    }

    async getProjectMap(): Promise<ProjectMap | null> {
        return this.projectMap;
    }

    /**
     * Static analysis using ts-morph
     */
    private generateProjectMap(workspacePath: string): ProjectMap {
        const project = new Project({
            compilerOptions: {
                allowJs: true,
                checkJs: false
            }
        });

        const searchPath = path.join(workspacePath, '**/*.{js,jsx,ts,tsx}');
        const ignorePath = `!${path.join(workspacePath, 'node_modules/**')}`;
        project.addSourceFilesAtPaths([searchPath, ignorePath]);

        const nodes: ProjectNode[] = [];
        const edges: ProjectEdge[] = [];

        const sourceFiles = project.getSourceFiles();

        sourceFiles.forEach(sourceFile => {
            const filePath = path.relative(workspacePath, sourceFile.getFilePath());
            const fileName = path.basename(filePath);

            // Handle Function Declarations
            sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => {
                const name = fn.getName() || 'anonymous';
                const nodeId = `${fileName}:${name}`;

                nodes.push({
                    id: nodeId,
                    label: name,
                    file: filePath,
                    line: fn.getStartLineNumber()
                });

                this.findEdges(fn, edges, fileName, name);
            });

            // Handle Arrow Functions
            sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(v => {
                const initializer = v.getInitializer();
                if (initializer && (
                    initializer.getKind() === SyntaxKind.ArrowFunction ||
                    initializer.getKind() === SyntaxKind.FunctionExpression
                )) {
                    const name = v.getName();
                    const nodeId = `${fileName}:${name}`;

                    nodes.push({
                        id: nodeId,
                        label: name,
                        file: filePath,
                        line: v.getStartLineNumber()
                    });

                    this.findEdges(initializer as ArrowFunction, edges, fileName, name);
                }
            });
        });

        return { nodes, edges };
    }

    private findEdges(
        fn: FunctionDeclaration | ArrowFunction,
        edges: ProjectEdge[],
        fileName: string,
        callerName: string
    ): void {
        const callerId = `${fileName}:${callerName}`;

        fn.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
            const targetName = call.getExpression().getText();
            edges.push({
                from: callerId,
                to: targetName,
                type: 'calls'
            });
        });
    }

    /**
     * Connect to V8 inspector and watch for function executions
     */
    private async connectToInspector(targetPath: string, port: number): Promise<void> {
        try {
            console.log(`🔍 WhyFlow: Connecting to inspector on port ${port}...`);
            const debugUrl = await this.getDebuggerUrl(port);

            this.watcherWs = new WebSocket(debugUrl);

            this.watcherWs.on('open', () => {
                console.log('🚀 WhyFlow: Connected to V8 Engine');

                this.watcherWs!.send(JSON.stringify({ id: 100, method: 'Profiler.enable' }));
                this.watcherWs!.send(JSON.stringify({ id: 101, method: 'Debugger.enable' }));
                this.watcherWs!.send(JSON.stringify({ id: 102, method: 'Debugger.resume' }));
                this.watcherWs!.send(JSON.stringify({
                    id: 103,
                    method: 'Profiler.startPreciseCoverage',
                    params: { callCount: true, detailed: true }
                }));

                console.log('▶️ WhyFlow: Profiling active. Watching for function calls...');
            });

            this.watcherWs.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.result && message.result.result) {
                    this.processCoverage(message.result.result, targetPath);
                }
            });

            this.watcherWs.on('error', (err) => {
                console.error('WhyFlow WS Error:', err);
            });

            // Poll for coverage data every 500ms
            this.watcherInterval = setInterval(() => {
                if (this.watcherWs && this.watcherWs.readyState === WebSocket.OPEN) {
                    this.watcherWs.send(JSON.stringify({ id: 200, method: 'Profiler.takePreciseCoverage' }));
                }
            }, 500);

        } catch (error) {
            console.error('❌ WhyFlow: Failed to connect to inspector:', error);
        }
    }

    private getDebuggerUrl(port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            http.get(`http://localhost:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const info = JSON.parse(data);
                        const target = info.find((item: any) => !item.url.includes('whyflow')) || info[0];
                        if (target && target.webSocketDebuggerUrl) {
                            resolve(target.webSocketDebuggerUrl);
                        } else {
                            reject('No debuggable target found');
                        }
                    } catch (e) {
                        reject('JSON Parse Error');
                    }
                });
            }).on('error', (e) => reject(`Is Node.js running with --inspect? ${e.message}`));
        });
    }

    private processCoverage(result: any[], targetPath: string): void {
        if (!result) return;

        const filterPath = path.resolve(targetPath).toLowerCase();

        result.forEach(script => {
            const scriptUrl = script.url.replace(/^file:\/\/\/?/, '').replace(/_/g, '/');
            const absPath = path.resolve(scriptUrl).toLowerCase();

            const isInProject = absPath.includes(filterPath);
            const isLibraryCode = absPath.includes('node_modules') ||
                absPath.includes('whyflow') ||
                absPath.includes('node:internal');

            if (isInProject && !isLibraryCode) {
                script.functions.forEach((fn: any) => {
                    if (fn.ranges[0].count > 0 && fn.functionName !== '') {
                        if (fn.functionName.includes('__') || fn.functionName === 'anonymous') return;

                        const fileName = path.basename(absPath);
                        const nodeId = `${fileName}:${fn.functionName}`;

                        console.log(`🎯 WhyFlow: [HIT] ${nodeId}`);

                        // Send to frontend via WebSocket
                        this.wss?.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    type: 'CALL',
                                    nodeId: nodeId
                                }));
                            }
                        });

                        // Also notify via RPC client
                        this.client?.onFunctionCall(nodeId);
                    }
                });
            }
        });
    }
}
