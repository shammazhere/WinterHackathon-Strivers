import { Project, SyntaxKind, FunctionDeclaration, FunctionExpression, ArrowFunction } from 'ts-morph';

export class Instrumenter {
    public project: Project; // Changed to public so index.ts can access it easily

    constructor(globPath: string) {
        this.project = new Project();
        this.project.addSourceFilesAtPaths(globPath);
    }

    public instrument(): string {
        const sourceFiles = this.project.getSourceFiles();

        sourceFiles.forEach(file => {
            const fileName = file.getBaseName();

            // We use a helper array to find all types of functions
            const allFunctions = [
                ...file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
                ...file.getDescendantsOfKind(SyntaxKind.FunctionExpression),
                ...file.getDescendantsOfKind(SyntaxKind.ArrowFunction)
            ];

            allFunctions.forEach(fn => {
                // Get name: check if it's a declaration, or look for an assigned variable name
                let name = "anonymous";
                if ("getName" in fn && typeof (fn as any).getName === 'function') {
                    name = (fn as any).getName() || "anonymous";
                }

                const nodeId = `${fileName}:${name}`;
                console.log(`  💉 Instrumenting: ${nodeId}`);

                // 1. Inject CALL at the very top of the function body
                // arguments is a built-in JS keyword that captures all passed params
                fn.insertStatements(0, `global.tracer.emit('CALL', '${nodeId}', { args: Array.from(arguments) });`);

                // 2. Inject RETURN at the end
                fn.addStatements(`global.tracer.emit('RETURN', '${nodeId}');`);
            });
        });

        // Compile to JS
        const result = this.project.emitToMemory();
        const files = result.getFiles();

        if (files.length === 0) {
            throw new Error("No files were emitted. Check your test-code path.");
        }

        return files[0].text;
    }
}