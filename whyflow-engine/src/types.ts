export interface ProjectNode {
    id: string;        // Unique hash or file:function name
    label: string;     // Function name
    file: string;      // Path to the source file
    line: number;      // Definition line for "jump to code"
}

export interface ProjectEdge {
    from: string;      // Source Node ID
    to: string;        // Target Node ID
}

export interface ProjectMap {
    nodes: ProjectNode[];
    edges: ProjectEdge[];
}

export type EventType = 'CALL' | 'RETURN';

export interface LiveEvent {
    type: EventType;
    nodeId: string;
    timestamp: number;
    metadata?: {
        args?: any[];
        result?: any;
        duration?: number;
    };
}