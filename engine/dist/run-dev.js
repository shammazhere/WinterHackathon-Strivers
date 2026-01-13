"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const analyzer_1 = require("./analyzer");
const tracer_1 = require("./tracer");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
async function main() {
    const projectPath = process.argv[2];
    if (!projectPath) {
        console.error('Usage: node run-dev.js <project-path>');
        process.exit(1);
    }
    const absoluteProjectPath = path.resolve(projectPath);
    const outputPath = path.join(process.cwd(), 'whyflow-data');
    const instrumentedPath = path.join(outputPath, 'instrumented');
    console.log(`Analyzing project at: ${absoluteProjectPath}`);
    const analyzer = new analyzer_1.Analyzer();
    const nodes = await analyzer.analyze(absoluteProjectPath);
    await fs.ensureDir(outputPath);
    await fs.writeJSON(path.join(outputPath, 'graph.json'), nodes, { spaces: 2 });
    console.log(`Graph data written to: ${path.join(outputPath, 'graph.json')}`);
    console.log(`Instrumenting code into: ${instrumentedPath}`);
    const tracer = new tracer_1.Tracer();
    // We only instrument .ts and .js files
    const files = await getFiles(absoluteProjectPath);
    for (const file of files) {
        const relativePath = path.relative(absoluteProjectPath, file);
        const outFilePath = path.join(instrumentedPath, relativePath);
        await tracer.instrument(file, outFilePath, absoluteProjectPath);
    }
    console.log('Instrumentation complete.');
    console.log('You can now run your code from the "instrumented" folder.');
    console.log('Runtime traces will be saved to "whyflow-trace.log".');
    // Start watching for failures
    startFailureWatcher(outputPath);
}
async function startFailureWatcher(outputPath) {
    const logPath = path.join(process.cwd(), 'whyflow-trace.log');
    const graphPath = path.join(outputPath, 'graph.json');
    const { explainFailure } = require('./ai');
    console.log('Watching for runtime failures...');
    let lastSize = 0;
    setInterval(async () => {
        try {
            const stats = await fs.stat(logPath);
            if (stats.size > lastSize) {
                const content = await fs.readFile(logPath, 'utf-8');
                const lines = content.split('\n').filter(l => l.trim());
                const lastLine = JSON.parse(lines[lines.length - 1]);
                if (lastLine.status === 'FAIL') {
                    console.log('Failure detected! Generating AI explanation...');
                    const graph = await fs.readJSON(graphPath);
                    const staticContext = JSON.stringify(graph.nodes.find((n) => n.id === lastLine.id));
                    const explanation = await explainFailure(staticContext, JSON.stringify(lastLine));
                    // Save explanation to a separate file for the editor to pick up
                    await fs.writeJSON(path.join(outputPath, 'explanation.json'), {
                        id: lastLine.id,
                        explanation
                    });
                    console.log('AI Explanation generated.');
                }
                lastSize = stats.size;
            }
        }
        catch (e) {
            // Log file might not exist yet
        }
    }, 2000);
}
async function getFiles(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                results = results.concat(await getFiles(filePath));
            }
        }
        else if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx')) {
            results.push(filePath);
        }
    }
    return results;
}
main().catch(console.error);
//# sourceMappingURL=run-dev.js.map