import { WebSocketServer, WebSocket } from 'ws';
import { LiveEvent, EventType } from './types';

let history: any[] = [];

export class RuntimeTracer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(port: number = 8080) {
        this.wss = new WebSocketServer({ port });
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log('🔗 Frontend Connected to Tracer');
            ws.on('close', () => this.clients.delete(ws));
        });
        console.log(`📡 Tracer WebSocket server started on ws://localhost:${port}`);
    }

    // This is the "Pulse" sender
    // Add this at the top of src/tracer.ts (outside the class)

    // Update your emit method:
    public emit(type: EventType, nodeId: string, metadata?: any) {
    const event = { type, nodeId, timestamp: Date.now(), metadata };
    const payload = JSON.stringify(event);

    // DEBUG: If this doesn't print, the Watcher isn't calling the Tracer
    console.log(`📡 [Tracer] Sending to ${this.clients.size} clients: ${nodeId}`);

    this.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(payload);
        }
    });
}

    /**
     * Professional Wrapper: This wraps a function to automatically 
     * emit events when it starts and ends.
     */
    public trace<T extends (...args: any[]) => any>(
        nodeId: string,
        fn: T
    ): T {
        const _self = this;
        return function (this: any, ...args: Parameters<T>): ReturnType<T> {
            _self.emit('CALL', nodeId, { args });

            const result = fn.apply(this, args);

            _self.emit('RETURN', nodeId, { result });
            return result;
        } as T;
    }
}