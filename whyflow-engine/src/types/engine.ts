export type NodeId = string;

export interface GraphEdge {
    from: NodeId;
    to: NodeId;
    type: "defines" | "calls" | "exports";
}

export interface Graph {
    nodes: NodeId[];
    edges: GraphEdge[];
}

export interface RuntimeEvent {
    fn: NodeId;
    ts: number;
}

export interface ComparisonResult {
    startFn: NodeId;

    expected: NodeId[];
    actual: NodeId[];

    matched: NodeId[];
    missing: NodeId[];
    unexpected: NodeId[];

    stopPoint?: NodeId;
}

export interface ExplanationModel {
    startFn: NodeId;

    facts: {
        matched: NodeId[];
        missing: NodeId[];
        unexpected: NodeId[];
        stopPoint?: NodeId;
    };

    hints: {
        type: "missing" | "unexpected";
        fn: NodeId;
        reason: string;
    }[];
}
