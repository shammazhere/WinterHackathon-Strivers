import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateDocs } from './ai';

export interface FunctionNode {
    id: string;
    name: string;
    file: string;
    line: number;
    calls: string[];
    docs?: string;
    code: string;
}

export interface WhyFlowGraph {
    nodes: FunctionNode[];
    links: { source: string, target: string }[];
}

export class Analyzer {
    private nodes: Map<string, FunctionNode> = new Map();

    private projectPath: string = '';

    async analyze(projectPath: string): Promise<WhyFlowGraph> {
        this.projectPath = path.resolve(projectPath);
        const files = await this.getFiles(this.projectPath);
        for (const file of files) {
            await this.analyzeFile(file);
        }
        
        const nodesArray = Array.from(this.nodes.values());
        
        // Generate documentation for each node in parallel
        console.log(`Generating documentation for ${nodesArray.length} functions...`);
        await Promise.all(nodesArray.map(async (node) => {
            node.docs = await generateDocs(node.name, node.code);
        }));

        const links: { source: string, target: string }[] = [];

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

    private async getFiles(dir: string): Promise<string[]> {
        let results: string[] = [];
        const list = await fs.readdir(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    results = results.concat(await this.getFiles(filePath));
                }
            } else if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx')) {
                results.push(filePath);
            }
        }
        return results;
    }

    private async analyzeFile(filePath: string) {
        const code = await fs.readFile(filePath, 'utf-8');
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        const currentFileNodes: string[] = [];

        traverse(ast, {
            FunctionDeclaration: (p) => {
                const node = this.createNode(p.node, filePath);
                if (node) this.nodes.set(node.id, node);
            },
            ArrowFunctionExpression: (p) => {
                // If it's assigned to a variable
                if (t.isVariableDeclarator(p.parent)) {
                    const node = this.createNode(p.node, filePath, (p.parent.id as any).name);
                    if (node) this.nodes.set(node.id, node);
                }
            },
            ClassMethod: (p) => {
                const node = this.createNode(p.node, filePath);
                if (node) this.nodes.set(node.id, node);
            }
        });

        // Second pass for calls
        traverse(ast, {
            CallExpression: (p) => {
                let caller: t.Node | undefined;
                let parent: any = p.parentPath;
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
                        const node = this.nodes.get(callerId)!;
                        if (!node.calls.includes(calleeName)) {
                            node.calls.push(calleeName);
                        }
                    }
                }
            }
        });
    }

    private getCalleeName(callee: any): string | null {
        if (t.isIdentifier(callee)) return callee.name;
        if (t.isMemberExpression(callee)) {
            if (t.isIdentifier(callee.property)) return callee.property.name;
        }
        return null;
    }

    private getNodeId(node: any, filePath: string): string {
        const line = node.loc?.start.line || 0;
        const name = node.id?.name || node.key?.name || 'anonymous';
        const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
        return `${relativePath}:${name}:${line}`;
    }

    private createNode(node: any, filePath: string, fallbackName?: string): FunctionNode | null {
        if (!node.loc) return null;
        const name = node.id?.name || node.key?.name || fallbackName || 'anonymous';
        const code = generate(node).code;
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
