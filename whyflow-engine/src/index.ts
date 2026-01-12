import { StaticAnalyzer } from './analyzer';
import { RuntimeTracer } from './tracer';
import { EngineWatcher } from './watcher';
import * as path from 'path';

/**
 * 1. Initialize the Transport Layer
 * This starts the WebSocket server that the HTML visualizer connects to.
 */
const tracer = new RuntimeTracer(8080);
(global as any).tracer = tracer;

/**
 * 2. Resolve the Target Project Path
 * We take the path from the command line argument: npx ts-node src/index.ts <path>
 */
const rawPath = process.argv[2];

if (!rawPath) {
    console.error("❌ Error: Please provide a project path.");
    console.log("Usage: npx ts-node src/index.ts ../your-nextjs-app");
    process.exit(1);
}

const absoluteTargetPath = path.resolve(rawPath);

/**
 * 3. Static Analysis (The Skeleton)
 * Scans the project directory to find all function definitions.
 */
console.log(`🔍 Mapping project at: ${absoluteTargetPath}`);
const analyzer = new StaticAnalyzer(absoluteTargetPath);
const map = analyzer.generateProjectMap();

console.log(`📊 Project Mapped: ${map.nodes.length} functions found.`);

/**
 * 4. Runtime Observation (The Pulse)
 * Attaches to the Node.js inspector of the running Next.js app.
 * We pass the target path so the watcher knows which files to filter for.
 */
tracer.setProjectMap(map);
const targetPort = process.argv[3] ? parseInt(process.argv[3]) : 9229;
const watcher = new EngineWatcher(absoluteTargetPath, targetPort);
watcher.connectAndWatch();

console.log("🚀 PocketFlow Engine is active and waiting for hits...");