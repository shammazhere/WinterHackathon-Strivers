import * as path from 'path';
import http from 'http';
import WebSocket from 'ws';

export class EngineWatcher {
    private filterPath: string;
    private targetPort: number;

    constructor(targetPath: string, port: number = 9229) {
        // Ensure the path is absolute and uses consistent slashes for Windows
        this.filterPath = path.resolve(targetPath).toLowerCase();
        this.targetPort = port;
    }

    public async connectAndWatch() {
        try {
            console.log(`🔍 Searching for Next.js on port ${this.targetPort}...`);
            const debugUrl = await this.getDebuggerUrl();

            const ws = new WebSocket(debugUrl);

            ws.on('open', () => {
                console.log("🚀 Connected to Next.js V8 Engine");

                // Initialize Profiler
                ws.send(JSON.stringify({ id: 100, method: 'Profiler.enable' }));
                ws.send(JSON.stringify({ id: 101, method: 'Debugger.enable' }));
                ws.send(JSON.stringify({ id: 102, method: 'Debugger.resume' }));

                // Start tracking
                ws.send(JSON.stringify({
                    id: 103,
                    method: 'Profiler.startPreciseCoverage',
                    params: { callCount: true, detailed: true }
                }));

                console.log("▶️ Profiling active. Hit your Next.js routes now!");
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                // V8 returns data in two ways: 
                // 1. As a result of 'takePreciseCoverage'
                // 2. As an event if specifically configured
                if (message.result && message.result.result) {
                    this.processCoverage(message.result.result);
                }
            });

            ws.on('error', (err) => console.error("WS Error:", err));

            // Request data every 500ms
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ id: 200, method: 'Profiler.takePreciseCoverage' }));
                }
            }, 500);

        } catch (e) {
            console.error(`❌ Watcher Fail: ${e}`);
        }
    }

    private getDebuggerUrl(): Promise<string> {
        return new Promise((resolve, reject) => {
            http.get(`http://localhost:${this.targetPort}/json/list`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const info = JSON.parse(data);
                        // Find the actual project target (usually the longest URL or non-internal)
                        const target = info.find((item: any) => !item.url.includes('whyflow-engine')) || info[0];

                        if (target && target.webSocketDebuggerUrl) {
                            resolve(target.webSocketDebuggerUrl);
                        } else {
                            reject("No debuggable target found.");
                        }
                    } catch (e) { reject("JSON Parse Error"); }
                });
            }).on('error', (e) => reject(`Is Next.js running? ${e.message}`));
        });
    }

    private processCoverage(result: any[]) {
        if (!result) return;

        result.forEach(script => {
            // 1. Clean up the path
            const scriptUrl = script.url.replace(/^file:\/\/\/?/, '').replace(/_/g, '/');
            const absPath = path.resolve(scriptUrl).toLowerCase();
            const filterPath = this.filterPath.toLowerCase();

            // 2. Identify the "Noise" keywords
            const noiseKeywords = [
                'node_modules',
                'next-dev-server',
                'hot-reloader',
                'turbopack',
                'manifest-loader',
                'entry-key',
                'middleware',
                'base-server',
                'patch-set-header'
            ];

            // 3. Apply the strict filter
            const isInProject = absPath.includes(filterPath);
            const hasNoise = noiseKeywords.some(keyword => absPath.includes(keyword));
            const isNextInternal = absPath.includes('.next');

            // ONLY proceed if it's in your project AND contains none of the noise
            if (isInProject && !hasNoise && !isNextInternal) {
                script.functions.forEach((fn: any) => {
                    if (fn.ranges[0].count > 0 && fn.functionName !== "") {

                        // Filter out "anonymous" or "eval" style functions that often come from build tools
                        if (fn.functionName.includes('__') || fn.functionName === 'anonymous') return;

                        const fileName = path.basename(absPath);
                        const nodeId = `${fileName}:${fn.functionName}`;

                        if ((global as any).tracer) {
                            console.log(`🎯 [USER CODE] ${nodeId}`);
                            (global as any).tracer.emit('CALL', nodeId, { hits: fn.ranges[0].count });
                        }
                    }
                });
            }
        });
    }
}