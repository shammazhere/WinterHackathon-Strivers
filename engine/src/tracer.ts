import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class Tracer {
    private projectPath: string = '';

    async instrument(filePath: string, outPath: string, projectPath: string) {
        this.projectPath = path.resolve(projectPath);
        const code = await fs.readFile(filePath, 'utf-8');
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        traverse(ast, {
            Function: (p) => {
                const node = p.node;
                const id = this.getNodeId(node, filePath);
                
                const traceCall = t.expressionStatement(
                    t.callExpression(t.identifier('__whyflow_trace__'), [
                        t.stringLiteral(id), 
                        t.stringLiteral('START'),
                        t.arrayExpression(node.params.map(p => {
                            if (t.isIdentifier(p)) return t.identifier(p.name);
                            return t.stringLiteral('complex-param');
                        }))
                    ])
                );

                const traceEnd = t.expressionStatement(
                    t.callExpression(t.identifier('__whyflow_trace__'), [t.stringLiteral(id), t.stringLiteral('END')])
                );

                if (t.isBlockStatement(node.body)) {
                    const originalBody = node.body.body;
                    const tryCatch = t.tryStatement(
                        t.blockStatement(originalBody),
                        t.catchClause(
                            t.identifier('error'),
                            t.blockStatement([
                                t.expressionStatement(
                                    t.callExpression(t.identifier('__whyflow_trace__'), [
                                        t.stringLiteral(id), 
                                        t.stringLiteral('FAIL'), 
                                        t.memberExpression(t.identifier('error'), t.identifier('message'))
                                    ])
                                ),
                                t.throwStatement(t.identifier('error'))
                            ])
                        ),
                        t.blockStatement([traceEnd])
                    );
                    node.body.body = [traceCall, tryCatch];
                } else {
                    // Arrow function with expression body
                    const originalExpr = node.body as t.Expression;
                    node.body = t.blockStatement([
                        traceCall,
                        t.tryStatement(
                            t.blockStatement([t.returnStatement(originalExpr)]),
                            t.catchClause(
                                t.identifier('error'),
                                t.blockStatement([
                                    t.expressionStatement(
                                        t.callExpression(t.identifier('__whyflow_trace__'), [
                                            t.stringLiteral(id), 
                                            t.stringLiteral('FAIL'), 
                                            t.memberExpression(t.identifier('error'), t.identifier('message'))
                                        ])
                                    ),
                                    t.throwStatement(t.identifier('error'))
                                ])
                            ),
                            t.blockStatement([traceEnd])
                        )
                    ]);
                }
            }
        });

        const output = generate(ast, {}, code);
        
        const finalCode = `
if (typeof globalThis.__whyflow_trace__ === 'undefined') {
    globalThis.__whyflow_trace__ = function(id, status, errorOrArgs) {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'whyflow-trace.log');
        const logEntry = {
            timestamp: Date.now(),
            id: id,
            status: status,
            data: status === 'START' ? errorOrArgs : (status === 'FAIL' ? errorOrArgs : null)
        };
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\\n');
    };
}
${output.code}`;

        await fs.ensureDir(path.dirname(outPath));
        await fs.writeFile(outPath, finalCode);
    }

    private getNodeId(node: any, filePath: string): string {
        const line = node.loc?.start.line || 0;
        const name = node.id?.name || node.key?.name || 'anonymous';
        const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
        return `${relativePath}:${name}:${line}`;
    }
}
