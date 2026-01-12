import { Project, SyntaxKind, FunctionDeclaration, ArrowFunction } from 'ts-morph';
import { ProjectMap, ProjectNode, ProjectEdge } from './types';
import * as path from 'path';

export class StaticAnalyzer {
    private project: Project;

    constructor(workspacePath: string) {
        // Resolve to absolute path to avoid relative path confusion
        const absolutePath = path.resolve(workspacePath);

        this.project = new Project({
            compilerOptions: {
                allowJs: true,
                checkJs: false
            }
        });

        // Directly add the files using an absolute glob
        const searchPath = path.join(absolutePath, "**/*.{js,jsx,ts,tsx}");
        const ignorePath = `!${path.join(absolutePath, "node_modules/**")}`;

        console.log(`Searching in: ${searchPath}`); // Debug log to verify path

        this.project.addSourceFilesAtPaths([searchPath, ignorePath]);
    }

    public generateProjectMap(): ProjectMap {
        const nodes: ProjectNode[] = [];
        const edges: ProjectEdge[] = [];

        const sourceFiles = this.project.getSourceFiles();

        sourceFiles.forEach(sourceFile => {
            const filePath = path.relative(process.cwd(), sourceFile.getFilePath());

            // 1. Handle Function Declarations
            sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => {
                const name = fn.getName() || 'anonymous';
                nodes.push(this.createNode(fn, filePath));

                // FIX: Pass all 4 required arguments
                this.findEdges(fn, edges, filePath, name);
            });

            // 2. Handle Arrow Functions (Variables)
            sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(v => {
                const initializer = v.getInitializer();
                if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
                    const name = v.getName();
                    const nodeId = `${filePath}:${name}`;

                    nodes.push({
                        id: nodeId,
                        label: name,
                        file: filePath,
                        line: v.getStartLineNumber()
                    });

                    // FIX: Pass all 4 required arguments
                    this.findEdges(initializer as any, edges, filePath, name);
                }
            });
        });

        return { nodes, edges };
    }

    private createNode(fn: FunctionDeclaration, filePath: string): ProjectNode {
        const name = fn.getName() || 'anonymous';
        const fileName = path.basename(filePath); 
        return {
            id: `${fileName}:${name}`, 
            label: name,
            file: filePath,
            line: fn.getStartLineNumber()
        };
    }

    // Add this helper to resolve symbol names to IDs
    private findEdges(fn: FunctionDeclaration | ArrowFunction, edges: ProjectEdge[], filePath: string, callerName: string) {
        const fileName = path.basename(filePath);
        const callerId = `${fileName}:${callerName}`; // Match the simplified ID format

        fn.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
            const targetName = call.getExpression().getText();
            
            edges.push({
                from: callerId, // "server.js:stepOne"
                to: targetName,  // "stepTwo"
                type: 'calls'
            });
        });
    }
}