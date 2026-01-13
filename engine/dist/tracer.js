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
exports.Tracer = void 0;
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class Tracer {
    constructor() {
        this.projectPath = '';
    }
    async instrument(filePath, outPath, projectPath) {
        this.projectPath = path.resolve(projectPath);
        const code = await fs.readFile(filePath, 'utf-8');
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
        (0, traverse_1.default)(ast, {
            Function: (p) => {
                const node = p.node;
                const id = this.getNodeId(node, filePath);
                const traceCall = t.expressionStatement(t.callExpression(t.identifier('__whyflow_trace__'), [
                    t.stringLiteral(id),
                    t.stringLiteral('START'),
                    t.arrayExpression(node.params.map(p => {
                        if (t.isIdentifier(p))
                            return t.identifier(p.name);
                        return t.stringLiteral('complex-param');
                    }))
                ]));
                const traceEnd = t.expressionStatement(t.callExpression(t.identifier('__whyflow_trace__'), [t.stringLiteral(id), t.stringLiteral('END')]));
                if (t.isBlockStatement(node.body)) {
                    const originalBody = node.body.body;
                    const tryCatch = t.tryStatement(t.blockStatement(originalBody), t.catchClause(t.identifier('error'), t.blockStatement([
                        t.expressionStatement(t.callExpression(t.identifier('__whyflow_trace__'), [
                            t.stringLiteral(id),
                            t.stringLiteral('FAIL'),
                            t.memberExpression(t.identifier('error'), t.identifier('message'))
                        ])),
                        t.throwStatement(t.identifier('error'))
                    ])), t.blockStatement([traceEnd]));
                    node.body.body = [traceCall, tryCatch];
                }
                else {
                    // Arrow function with expression body
                    const originalExpr = node.body;
                    node.body = t.blockStatement([
                        traceCall,
                        t.tryStatement(t.blockStatement([t.returnStatement(originalExpr)]), t.catchClause(t.identifier('error'), t.blockStatement([
                            t.expressionStatement(t.callExpression(t.identifier('__whyflow_trace__'), [
                                t.stringLiteral(id),
                                t.stringLiteral('FAIL'),
                                t.memberExpression(t.identifier('error'), t.identifier('message'))
                            ])),
                            t.throwStatement(t.identifier('error'))
                        ])), t.blockStatement([traceEnd]))
                    ]);
                }
            }
        });
        const output = (0, generator_1.default)(ast, {}, code);
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
    getNodeId(node, filePath) {
        const line = node.loc?.start.line || 0;
        const name = node.id?.name || node.key?.name || 'anonymous';
        const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
        return `${relativePath}:${name}:${line}`;
    }
}
exports.Tracer = Tracer;
//# sourceMappingURL=tracer.js.map