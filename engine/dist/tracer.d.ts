export declare class Tracer {
    private projectPath;
    instrument(filePath: string, outPath: string, projectPath: string): Promise<void>;
    private getNodeId;
}
