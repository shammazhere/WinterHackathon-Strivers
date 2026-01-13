import { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

/**
 * Project node representing a function in the codebase
 */
export interface ProjectNode {
    id: string;        // Unique identifier: "filename:functionName"
    label: string;     // Function name
    file: string;      // Path to the source file
    line: number;      // Definition line number
}

/**
 * Edge representing a function call relationship
 */
export interface ProjectEdge {
    from: string;
    to: string;
    type?: string;
}

/**
 * Complete project map with nodes and edges
 */
export interface ProjectMap {
    nodes: ProjectNode[];
    edges: ProjectEdge[];
}

/**
 * Status of the WhyFlow engine
 */
export interface WhyFlowStatus {
    isRunning: boolean;
    projectPath?: string;
    nodeCount?: number;
    tracerPort?: number;
    inspectorPort?: number;
}

/**
 * Path for the WhyFlow service
 */
export const WHYFLOW_SERVICE_PATH = '/services/whyflow';

/**
 * Service interface for frontend-backend communication
 */
export const WhyFlowService = Symbol('WhyFlowService');
export interface WhyFlowService extends RpcServer<WhyFlowClient> {
    /**
     * Start the WhyFlow engine for a project
     * @param projectPath Absolute path to the Node.js project
     * @param entryFile Entry point file (e.g., server.js)
     * @param inspectorPort Port for Node.js inspector (default: 9229)
     */
    startEngine(projectPath: string, entryFile: string, inspectorPort?: number): Promise<WhyFlowStatus>;

    /**
     * Stop the currently running engine
     */
    stopEngine(): Promise<void>;

    /**
     * Get current engine status
     */
    getStatus(): Promise<WhyFlowStatus>;

    /**
     * Get the static project map (nodes and edges)
     */
    getProjectMap(): Promise<ProjectMap | null>;
}

/**
 * Client interface for receiving events from backend
 */
export const WhyFlowClient = Symbol('WhyFlowClient');
export interface WhyFlowClient {
    /**
     * Called when a function is executed at runtime
     */
    onFunctionCall(nodeId: string): void;

    /**
     * Called when engine status changes
     */
    onStatusChange(status: WhyFlowStatus): void;
}
