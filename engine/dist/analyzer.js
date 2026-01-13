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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analyzer = void 0;
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const ai_1 = require("./ai");
class Analyzer {
    constructor() {
        this.nodes = new Map();
        this.projectPath = '';
    }
    async analyze(projectPath) {
        this.projectPath = path.resolve(projectPath);
        const files = await this.getFiles(this.projectPath);
        for (const file of files) {
            await this.analyzeFile(file);
        }
        const nodesArray = Array.from(this.nodes.values());
        // Generate documentation for each node in parallel
        console.log(`Generating documentation for ${nodesArray.length} functions...`);
        await Promise.all(nodesArray.map(async (node) => {
            node.docs = await (0, ai_1.generateDocs)(node.name, node.code);
        }));
        const links = [];
        // Build links based on calls
        for (const node of nodesArray) {
            for (const callName of node.calls) {
                // Find potential targets (functions with this name)
                const targets = nodesArray.filter(n => n.name === callName);
                for (const target of targets) {
                    links.push({ source: node.id, target: target.id });
                }
            }
        }
        return { nodes: nodesArray, links };
    }
    async getFiles(dir) {
        let results = [];
        const list = await fs.readdir(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    results = results.concat(await this.getFiles(filePath));
                }
            }
            else if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx')) {
                results.push(filePath);
            }
        }
        return results;
    }
    async analyzeFile(filePath) {
        const code = await fs.readFile(filePath, 'utf-8');
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
        const currentFileNodes = [];
        (0, traverse_1.default)(ast, {
            FunctionDeclaration: (p) => {
                const node = this.createNode(p.node, filePath);
                if (node)
                    this.nodes.set(node.id, node);
            },
            ArrowFunctionExpression: (p) => {
                // If it's assigned to a variable
                if (t.isVariableDeclarator(p.parent)) {
                    const node = this.createNode(p.node, filePath, p.parent.id.name);
                    if (node)
                        this.nodes.set(node.id, node);
                }
            },
            ClassMethod: (p) => {
                const node = this.createNode(p.node, filePath);
                if (node)
                    this.nodes.set(node.id, node);
            }
        });
        // Second pass for calls
        (0, traverse_1.default)(ast, {
            CallExpression: (p) => {
                let caller;
                let parent = p.parentPath;
                while (parent) {
                    if (t.isFunctionDeclaration(parent.node) || t.isArrowFunctionExpression(parent.node) || t.isClassMethod(parent.node)) {
                        caller = parent.node;
                        break;
                    }
                    parent = parent.parentPath;
                }
                if (caller) {
                    const callerId = this.getNodeId(caller, filePath);
                    const calleeName = this.getCalleeName(p.node.callee);
                    if (calleeName && this.nodes.has(callerId)) {
                        const node = this.nodes.get(callerId);
                        if (!node.calls.includes(calleeName)) {
                            node.calls.push(calleeName);
                        }
                    }
                }
            }
        });
    }
    getCalleeName(callee) {
        if (t.isIdentifier(callee))
            return callee.name;
        if (t.isMemberExpression(callee)) {
            if (t.isIdentifier(callee.property))
                return callee.property.name;
        }
        return null;
    }
    getNodeId(node, filePath) {
        const line = node.loc?.start.line || 0;
        const name = node.id?.name || node.key?.name || 'anonymous';
        const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
        return `${relativePath}:${name}:${line}`;
    }
    createNode(node, filePath, fallbackName) {
        if (!node.loc)
            return null;
        const name = node.id?.name || node.key?.name || fallbackName || 'anonymous';
        const code = (0, generator_1.default)(node).code;
        return {
            id: this.getNodeId(node, filePath),
            name,
            file: filePath,
            line: node.loc.start.line,
            calls: [],
            code
        };
    }
}
exports.Analyzer = Analyzer;
//# sourceMappingURL=analyzer.js.map