import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core/lib/common';
import { CommonMenus, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';

export const WhyFlowAnalyzeCommand: Command = {
    id: 'whyflow.analyze',
    label: 'WhyFlow: Analyze Project'
};

export const WhyFlowRunWithTraceCommand: Command = {
    id: 'whyflow.runWithTrace',
    label: 'WhyFlow: Run with Trace',
    iconClass: 'codicon codicon-play'
};

export const WhyFlowOpenDiagramCommand: Command = {
    id: 'whyflow.openDiagram',
    label: 'WhyFlow: Open Flow Diagram',
    iconClass: 'codicon codicon-type-hierarchy'
};

export const WhyFlowClearTraceCommand: Command = {
    id: 'whyflow.clearTrace',
    label: 'WhyFlow: Clear Trace'
};

export interface TraceEvent {
    timestamp: number;
    id: string;
    name: string;
    file: string;
    line: number;
    status: 'START' | 'END' | 'FAIL';
    args?: any[];
    result?: any;
    error?: string;
}

@injectable()
export class HelloWorldCommandContribution implements CommandContribution {
    
    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(TerminalService)
    protected readonly terminalService!: TerminalService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    protected traceLogPath: string | undefined;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(WhyFlowAnalyzeCommand, {
            execute: async () => {
                const roots = this.workspaceService.tryGetRoots();
                const workspace = roots[0];
                if (!workspace) {
                    this.messageService.error('No workspace found.');
                    return;
                }
                const workspaceUri = workspace.resource.toString();
                
                this.messageService.info('WhyFlow: Analyzing project structure...');
                await this.ensureTraceInfrastructure(workspaceUri);
                await this.performStaticAnalysis(workspaceUri);
                this.messageService.info('WhyFlow: Analysis complete. Open the diagram to see the results.');
            }
        });

        registry.registerCommand(WhyFlowRunWithTraceCommand, {
            execute: async () => {
                const roots = this.workspaceService.tryGetRoots();
                const workspace = roots[0];
                if (!workspace) {
                    this.messageService.error('No workspace found.');
                    return;
                }
                const workspaceUri = workspace.resource.toString();
                
                await this.clearTraceLog(workspaceUri);
                await this.ensureTraceInfrastructure(workspaceUri);
                await this.ensureDemoFile(workspaceUri);
                
                const activeEditor = this.editorManager.currentEditor;
                let fileToRun = 'index.js';
                
                if (activeEditor && activeEditor.uri.path.ext === '.js') {
                    fileToRun = activeEditor.uri.path.base;
                }

                const terminal = await this.terminalService.newTerminal({ title: 'WhyFlow Run' });
                terminal.show();
                terminal.sendText(`node --require ./whyflow-data/tracer.js ${fileToRun}\n`);
                this.messageService.info(`Running ${fileToRun} with WhyFlow trace enabled...`);
            }
        });

        registry.registerCommand(WhyFlowClearTraceCommand, {
            execute: async () => {
                const roots = this.workspaceService.tryGetRoots();
                const workspace = roots[0];
                if (!workspace) {
                    this.messageService.error('No workspace found.');
                    return;
                }
                await this.clearTraceLog(workspace.resource.toString());
                this.messageService.info('Trace log cleared.');
            }
        });

        registry.registerCommand(WhyFlowOpenDiagramCommand, {
            execute: async () => {
                registry.executeCommand('whyflow-view:toggle');
            }
        });
    }

    protected async performStaticAnalysis(workspaceUri: string): Promise<void> {
        const graphPath = new URI(workspaceUri + '/whyflow-data/graph.json');
        const nodes: any[] = [];
        const links: any[] = [];
        const seen = new Set();

        const files = await this.fileService.resolve(new URI(workspaceUri));
        if (files.children) {
            for (const file of files.children) {
                if (file.resource.path.ext === '.js' && !file.resource.path.toString().includes('whyflow-data')) {
                    const content = await this.fileService.read(file.resource);
                    const code = content.value;
                    const fileName = file.resource.path.base;

                    // Basic regex to find function declarations and calls
                    const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
                    const arrowFuncRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
                    
                    let match;
                    while ((match = funcRegex.exec(code)) !== null) {
                        const name = match[1];
                        const id = `${fileName}:${name}:0`;
                        if (!seen.has(id)) {
                            nodes.push({ id, name, file: fileName, line: 0, docs: 'Staticly discovered function' });
                            seen.add(id);
                        }
                    }
                    while ((match = arrowFuncRegex.exec(code)) !== null) {
                        const name = match[1];
                        const id = `${fileName}:${name}:0`;
                        if (!seen.has(id)) {
                            nodes.push({ id, name, file: fileName, line: 0, docs: 'Staticly discovered arrow function' });
                            seen.add(id);
                        }
                    }
                }
            }
        }

        if (nodes.length > 0) {
            await this.fileService.write(graphPath, JSON.stringify({ nodes, links }, null, 2));
        }
    }

    protected async ensureDemoFile(workspaceUri: string): Promise<void> {
        const demoPath = new URI(workspaceUri + '/index.js');
        try {
            await this.fileService.resolve(demoPath);
        } catch {
            const demoCode = `
/**
 * WhyFlow Demo Script
 * Press F5 to run this script with automatic tracing.
 * Press Ctrl+Shift+D to open the flow diagram.
 */

function main() {
    console.log("Starting WhyFlow Demo...");
    const result = calculateData(10, 20);
    processResult(result);
    
    // Simulate an error
    try {
        riskyOperation();
    } catch (e) {
        console.log("Caught expected error:", e.message);
    }
}

function calculateData(a, b) {
    const sum = add(a, b);
    return sum * 2;
}

function add(a, b) {
    return a + b;
}

function processResult(data) {
    console.log("Processing result:", data);
    saveToDatabase(data);
}

function saveToDatabase(data) {
    console.log("Data saved.");
}

function riskyOperation() {
    throw new Error("Something went wrong in the risky operation!");
}

main();
`;
            await this.fileService.write(demoPath, demoCode);
        }
    }

    protected async ensureTraceInfrastructure(workspaceUri: string): Promise<void> {
        const dataDir = new URI(workspaceUri + '/whyflow-data');
        const tracerPath = new URI(workspaceUri + '/whyflow-data/tracer.js');
        const graphPath = new URI(workspaceUri + '/whyflow-data/graph.json');
        
        try {
            await this.fileService.resolve(dataDir);
        } catch {
            await this.fileService.createFolder(dataDir);
        }

        const tracerCode = this.generateTracerCode();
        await this.fileService.write(tracerPath, tracerCode);

        try {
            await this.fileService.resolve(graphPath);
        } catch {
            const defaultGraph = JSON.stringify({
                nodes: [
                    { id: 'main', name: 'main', file: 'index.js', line: 1, docs: 'Entry point' }
                ],
                links: []
            }, null, 2);
            await this.fileService.write(graphPath, defaultGraph);
        }
    }

    protected generateTracerCode(): string {
        return `
const fs = require('fs');
const path = require('path');
const Module = require('module');

const TRACE_LOG = path.join(__dirname, '..', 'whyflow-trace.log');
const GRAPH_FILE = path.join(__dirname, 'graph.json');

let graph = { nodes: [], links: [] };
let callStack = [];
let nodeSet = new Set();

try {
    if (fs.existsSync(GRAPH_FILE)) {
        graph = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'));
        graph.nodes.forEach(n => nodeSet.add(n.id));
    }
} catch (e) {}

function writeTrace(event) {
    const line = JSON.stringify(event) + '\\n';
    fs.appendFileSync(TRACE_LOG, line);
}

function addNode(id, name, file, line) {
    if (!nodeSet.has(id)) {
        nodeSet.add(id);
        graph.nodes.push({ id, name, file, line, docs: '' });
    }
}

function addLink(source, target) {
    const exists = graph.links.some(l => l.source === source && l.target === target);
    if (!exists && source !== target) {
        graph.links.push({ source, target });
    }
}

function saveGraph() {
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
}

function getCallerInfo() {
    const err = new Error();
    const stack = err.stack.split('\\n');
    for (let i = 3; i < stack.length; i++) {
        const line = stack[i];
        const match = line.match(/at\\s+(?:(.+?)\\s+)?\\(?(.+?):(\\d+):(\\d+)\\)?/);
        if (match && !match[2].includes('node_modules') && !match[2].includes('tracer.js')) {
            return {
                name: match[1] || 'anonymous',
                file: path.relative(process.cwd(), match[2]),
                line: parseInt(match[3], 10)
            };
        }
    }
    return null;
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    const result = originalRequire.apply(this, arguments);
    
    if (typeof result === 'object' && result !== null && !id.startsWith('.')) {
        return result;
    }
    
    if (typeof result === 'function') {
        return wrapFunction(result, id);
    }
    
    if (typeof result === 'object' && result !== null) {
        return wrapObject(result, id);
    }
    
    return result;
};

function wrapFunction(fn, name) {
    if (fn.__whyflow_wrapped) return fn;
    
    const wrapped = function(...args) {
        const caller = getCallerInfo();
        const id = caller ? \`\${caller.file}:\${caller.name}:\${caller.line}\` : name;
        
        addNode(id, caller?.name || name, caller?.file || 'unknown', caller?.line || 0);
        
        if (callStack.length > 0) {
            addLink(callStack[callStack.length - 1], id);
        }
        
        callStack.push(id);
        writeTrace({ timestamp: Date.now(), id, name: caller?.name || name, file: caller?.file || 'unknown', line: caller?.line || 0, status: 'START', args: args.map(a => typeof a) });
        
        try {
            const result = fn.apply(this, args);
            
            if (result && typeof result.then === 'function') {
                return result.then(
                    res => {
                        writeTrace({ timestamp: Date.now(), id, name: caller?.name || name, file: caller?.file || 'unknown', line: caller?.line || 0, status: 'END' });
                        callStack.pop();
                        saveGraph();
                        return res;
                    },
                    err => {
                        writeTrace({ timestamp: Date.now(), id, name: caller?.name || name, file: caller?.file || 'unknown', line: caller?.line || 0, status: 'FAIL', error: err.message });
                        callStack.pop();
                        saveGraph();
                        throw err;
                    }
                );
            }
            
            writeTrace({ timestamp: Date.now(), id, name: caller?.name || name, file: caller?.file || 'unknown', line: caller?.line || 0, status: 'END' });
            callStack.pop();
            saveGraph();
            return result;
        } catch (err) {
            writeTrace({ timestamp: Date.now(), id, name: caller?.name || name, file: caller?.file || 'unknown', line: caller?.line || 0, status: 'FAIL', error: err.message });
            callStack.pop();
            saveGraph();
            throw err;
        }
    };
    
    wrapped.__whyflow_wrapped = true;
    Object.defineProperty(wrapped, 'name', { value: fn.name });
    return wrapped;
}

function wrapObject(obj, moduleName) {
    const wrapped = {};
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'function') {
            wrapped[key] = wrapFunction(obj[key], \`\${moduleName}.\${key}\`);
        } else {
            wrapped[key] = obj[key];
        }
    }
    return wrapped;
}

process.on('exit', () => {
    saveGraph();
});

console.log('[WhyFlow] Tracer initialized. Trace output:', TRACE_LOG);
`;
    }

    protected async clearTraceLog(workspaceUri: string): Promise<void> {
        const tracePath = new URI(workspaceUri + '/whyflow-trace.log');
        try {
            await this.fileService.write(tracePath, '');
        } catch {}
    }
}

@injectable()
export class HelloWorldMenuContribution implements MenuContribution {

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW, {
            commandId: WhyFlowAnalyzeCommand.id,
            label: WhyFlowAnalyzeCommand.label,
            order: '1'
        });
        menus.registerMenuAction(CommonMenus.VIEW, {
            commandId: WhyFlowRunWithTraceCommand.id,
            label: WhyFlowRunWithTraceCommand.label,
            order: '2'
        });
        menus.registerMenuAction(CommonMenus.VIEW, {
            commandId: WhyFlowOpenDiagramCommand.id,
            label: WhyFlowOpenDiagramCommand.label,
            order: '3'
        });
        menus.registerMenuAction(CommonMenus.VIEW, {
            commandId: WhyFlowClearTraceCommand.id,
            label: WhyFlowClearTraceCommand.label,
            order: '4'
        });
    }
}

@injectable()
export class HelloWorldKeybindingContribution implements KeybindingContribution {
    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: WhyFlowRunWithTraceCommand.id,
            keybinding: 'F5'
        });
        keybindings.registerKeybinding({
            command: WhyFlowOpenDiagramCommand.id,
            keybinding: 'ctrl+shift+d'
        });
    }
}
