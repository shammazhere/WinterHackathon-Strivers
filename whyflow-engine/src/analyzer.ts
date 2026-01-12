import { Project, SyntaxKind, FunctionDeclaration, ArrowFunction } from 'ts-morph';
import { ProjectMap, ProjectNode, ProjectEdge } from './types';
import * as path from 'path';

export class StaticAnalyzer {
    private project: Project;

    constructor(workspacePath: string) {
        this.project = new Project();
        this.project.addSourceFilesAtPaths(`${workspacePath}/**/*.ts`);
    }

    public generateProjectMap(): ProjectMap {
        const nodes: ProjectNode[] = [];
        const edges: ProjectEdge[] = []; // Edges are populated via call-expression analysis

        const sourceFiles = this.project.getSourceFiles();

        sourceFiles.forEach(sourceFile => {
            const filePath = path.relative(process.cwd(), sourceFile.getFilePath());

            // 1. Find all Function Declarations
            sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => {
                nodes.push(this.createNode(fn, filePath));
                this.findEdges(fn, edges);
            });

            // 2. Find Arrow Functions assigned to variables
            sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(v => {
                const initializer = v.getInitializer();
                if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
                    nodes.push({
                        id: `${filePath}:${v.getName()}`,
                        label: v.getName(),
                        file: filePath,
                        line: v.getStartLineNumber()
                    });
                }
            });
        });

        return { nodes, edges };
    }

    private createNode(fn: FunctionDeclaration, filePath: string): ProjectNode {
        const name = fn.getName() || 'anonymous';
        return {
            id: `${filePath}:${name}`,
            label: name,
            file: filePath,
            line: fn.getStartLineNumber()
        };
    }

    private findEdges(fn: FunctionDeclaration, edges: ProjectEdge[]) {
        const filePath = path.relative(process.cwd(), fn.getSourceFile().getFilePath());
        const callerId = `${filePath}:${fn.getName()}`;

        // Look for call expressions inside this function
        fn.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
            const expression = call.getExpression();
            const targetName = expression.getText();

            edges.push({
                from: callerId,
                to: targetName // In a production version, we would resolve the actual symbol
            });
        });
    }
}