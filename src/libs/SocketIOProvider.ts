import * as Y from "yjs";
import { Socket } from "socket.io-client";
import * as awarenessProtocol from "y-protocols/awareness";

export class SocketIOProvider {
  public awareness: awarenessProtocol.Awareness;
  private socket: Socket;
  private doc: Y.Doc;
  private docId: string;

  constructor(docId: string, doc: Y.Doc, socket: Socket) {
    this.docId = docId;
    this.doc = doc;
    this.socket = socket;
    this.awareness = new awarenessProtocol.Awareness(doc);

    // Listen for updates from local Y.Doc and send to server
    this.doc.on("update", (update: Uint8Array, origin: any) => {
      // Only send updates that originated from this client
      // Don't send updates that came from the server (origin === this)
      if (origin !== this) {
        this.socket.emit("doc:change", {
          docId: this.docId,
          yjsSnapshot: Array.from(update), // Convert Uint8Array to regular array for socket
        });
      }
    });

    // Listen for updates from server and apply to local Y.Doc
    this.socket.on(
      "doc:changed",
      (data: { yjsSnapshot?: number[]; clientId?: string }) => {
        // Don't apply our own changes back (prevent echo)
        if (data.clientId !== this.socket.id && data.yjsSnapshot) {
          const update = new Uint8Array(data.yjsSnapshot);
          // Pass 'this' as origin so we don't re-emit this update
          Y.applyUpdate(this.doc, update, this);
        }
      }
    );

    // Awareness (cursor positions, user presence)
    // Note: Backend sends custom format, not binary awareness updates
    this.awareness.on("change", () => {
      const localState = this.awareness.getLocalState();
      if (localState) {
        this.socket.emit("doc:cursor", {
          docId: this.docId,
          cursorPosition: localState.cursor || {},
        });
      }
    });

    // Backend sends cursor updates as JSON objects, not binary
    // This is handled by BlockNote's built-in collaboration
    // We don't need to manually apply awareness updates here
  }

  destroy() {
    this.socket.off("doc:changed");
    this.socket.off("user:cursor");
    this.awareness.destroy();
  }
}
