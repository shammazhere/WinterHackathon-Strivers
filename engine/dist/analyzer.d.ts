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
    links: {
        source: string;
        target: string;
    }[];
}
export declare class Analyzer {
    private nodes;
    private projectPath;
    analyze(projectPath: string): Promise<WhyFlowGraph>;
    private getFiles;
    private analyzeFile;
    private getCalleeName;
    private getNodeId;
    private createNode;
}
