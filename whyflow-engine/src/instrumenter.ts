import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

export class UniversalInstrumenter {
    private project: Project;

    constructor(targetDir: string) {
        this.project = new Project();
        // Look for all TS, TSX, JS, and JSX files
        this.project.addSourceFilesAtPaths([
            path.join(targetDir, 'src/**/*.{ts,tsx,js,jsx}'),
            path.join(targetDir, 'pages/**/*.{ts,tsx,js,jsx}'), // For Next.js
            path.join(targetDir, 'app/**/*.{ts,tsx,js,jsx}')    // For Next.js 13+
        ]);
    }

    public instrumentAndSave(outputDir: string) {
        const sourceFiles = this.project.getSourceFiles();

        sourceFiles.forEach(file => {
            const fileName = file.getBaseName();

            // 1. Inject a 'window' or 'global' safe tracer reference at the top
            // This ensures React (browser) and Node (server) both find the tracer
            file.insertStatements(0, `const _PF_TRACER = typeof window !== 'undefined' ? window.tracer : global.tracer;`);

            // 2. Target all types of functions
            const functions = [
                ...file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
                ...file.getDescendantsOfKind(SyntaxKind.ArrowFunction),
                ...file.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
            ];

            functions.forEach(fn => {
                let name = "anonymous";
                if ("getName" in fn && typeof (fn as any).getName === 'function') {
                    name = (fn as any).getName() || "anonymous";
                }

                const nodeId = `${fileName}:${name}`;

                // Inject sensors
                // We use a check to make sure the tracer exists before calling it
                const callCode = `if(_PF_TRACER) _PF_TRACER.emit('CALL', '${nodeId}');`;
                const returnCode = `if(_PF_TRACER) _PF_TRACER.emit('RETURN', '${nodeId}');`;

                if ("insertStatements" in fn) {
                    (fn as any).insertStatements(0, callCode);
                    (fn as any).addStatements(returnCode);
                }
            });

            // 3. Save to a shadow directory
            const relativePath = file.getFilePath().split(path.sep).pop()!;
            file.saveSync(); // Or use file.copy(newPath)
        });

        console.log(`✅ Successfully instrumented ${sourceFiles.length} files.`);
    }
}