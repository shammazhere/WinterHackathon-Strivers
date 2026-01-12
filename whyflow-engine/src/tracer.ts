import { WebSocketServer, WebSocket } from 'ws';
import { ProjectMap } from './types';

export class RuntimeTracer {
    private wss: WebSocketServer;
    private projectMap: ProjectMap | null = null; // Store the map here

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws) => {
            console.log("🔗 Frontend Connected to Tracer");
            
            // Give the browser 100ms to initialize its D3 listeners before sending the map
            setTimeout(() => {
                if (this.projectMap) {
                    console.log("📤 Sending map to frontend...");
                    this.sendMapToClient(ws);
                }
            }, 100);
        });
        
        this.wss.on('connection', (ws) => {
            ws.on('message', (rawData) => {
                const msg = JSON.parse(rawData.toString());
                if (msg.type === 'REQUEST_MAP' && this.projectMap) {
                    this.sendMapToClient(ws);
                }
            });
        });

        console.log(`📡 Tracer WebSocket server started on ws://localhost:${port}`);
    }

    /**
     * This is the method your index.ts was looking for!
     */
    public setProjectMap(map: ProjectMap) {
        this.projectMap = map;

        // Send the map to any clients already connected
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                this.sendMapToClient(client);
            }
        });
    }

    private sendMapToClient(ws: WebSocket) {
        ws.send(JSON.stringify({
            type: 'INIT_MAP',
            data: this.projectMap
        }));
    }

    public sendHit(nodeId: string) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'CALL',
                    nodeId: nodeId
                }));
            }
        });
    }
}