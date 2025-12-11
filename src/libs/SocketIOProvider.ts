import * as Y from "yjs";
import { Socket } from "socket.io-client";
import * as awarenessProtocol from "y-protocols/awareness";

export class SocketIOProvider {
  public awareness: awarenessProtocol.Awareness;
  private readonly socket: Socket;
  private readonly doc: Y.Doc;
  private readonly docId: string;
  private snapshotTimeout: NodeJS.Timeout | null = null;
  private plainTextTimeout: NodeJS.Timeout | null = null;
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null =
    null;

  constructor(docId: string, doc: Y.Doc, socket: Socket) {
    this.docId = docId;
    this.doc = doc;
    this.socket = socket;
    this.awareness = new awarenessProtocol.Awareness(doc);

    console.log("🔌 SocketIOProvider initialized:", {
      docId,
      socketId: socket.id,
    });

    this.setupUpdateListener();
    this.setupSocketListeners();
    this.setupAwarenessSync();
  }

  private setupUpdateListener() {
    // Listen for updates from local Y.Doc and send to server
    this.updateHandler = (update: Uint8Array, origin: any) => {
      // Only send updates that originated from this client
      // Don't send updates that came from the server (origin === this)
      if (origin !== this) {
        console.log(
          `🚀 Y.Doc update detected: ${update.length} bytes (${(
            update.length / 1024
          ).toFixed(2)} KB)`
        );

        // 🚀 HYBRID APPROACH:
        // 1. Gửi incremental update NGAY LẬP TỨC cho broadcast (real-time)
        // 2. Debounce full state cho DB (data integrity)

        // ⚡ Send incremental update immediately (no debounce for real-time feel)
        console.log(
          `🚀 Broadcasting incremental: ${update.length} bytes (${(
            update.length / 1024
          ).toFixed(2)} KB)`
        );

        this.socket.emit("doc:broadcast", {
          docId: this.docId,
          yjsUpdate: Array.from(update), // Incremental - chỉ broadcast, không lưu DB
        });

        // 💾 Debounce full state for DB persistence
        if (this.snapshotTimeout) {
          clearTimeout(this.snapshotTimeout);
        }

        this.snapshotTimeout = setTimeout(() => {
          const fullState = Y.encodeStateAsUpdate(this.doc);

          console.log(
            `💾 Saving full state to DB: ${fullState.length} bytes (${(
              fullState.length / 1024
            ).toFixed(2)} KB)`
          );

          this.socket.emit("doc:change", {
            docId: this.docId,
            yjsSnapshot: Array.from(fullState), // Full state - lưu DB
          });
        }, 1000); // 1s debounce cho DB save

        // 📝 Debounce plainText extraction separately
        if (this.plainTextTimeout) {
          clearTimeout(this.plainTextTimeout);
        }

        this.plainTextTimeout = setTimeout(() => {
          const plainText = this.extractPlainText();

          this.socket.emit("doc:change", {
            docId: this.docId,
            plainText: plainText,
          });
        }, 2000); // 2s - only for search indexing
      }
    };

    this.doc.on("update", this.updateHandler);
  }

  private setupSocketListeners() {
    // Listen for REAL-TIME incremental updates from other users
    console.log(
      "📡 Registering socket listeners for doc:broadcasted and doc:changed"
    );

    this.socket.on(
      "doc:broadcasted",
      (data: { yjsUpdate?: number[]; clientId?: string; userId?: string }) => {
        console.log("🎯 doc:broadcasted event received:", {
          hasUpdate: !!data.yjsUpdate,
          updateSize: data.yjsUpdate?.length,
          fromClient: data.clientId,
          fromUser: data.userId,
          myClientId: this.socket.id,
        });

        // Apply incremental updates from other users
        if (data.clientId !== this.socket.id && data.yjsUpdate) {
          try {
            // Validate data size (max 10MB for incremental update)
            if (!Array.isArray(data.yjsUpdate)) {
              console.error("Invalid yjsUpdate: not an array");
              return;
            }
            if (data.yjsUpdate.length > 10 * 1024 * 1024) {
              console.error(
                `yjsUpdate too large: ${data.yjsUpdate.length} bytes (max 10MB)`
              );
              return;
            }

            console.log(
              `📥 Received broadcast from ${data.userId}: ${
                data.yjsUpdate.length
              } bytes (${(data.yjsUpdate.length / 1024).toFixed(2)} KB)`
            );

            const update = new Uint8Array(data.yjsUpdate);
            // Pass 'this' as origin so we don't re-emit this update
            Y.applyUpdate(this.doc, update, this);
          } catch (error) {
            console.error("Failed to apply broadcast update:", error);
          }
        }
      }
    );

    // Listen for FULL STATE updates from DB (when joining or syncing)
    this.socket.on(
      "doc:changed",
      (data: { yjsSnapshot?: number[]; clientId?: string }) => {
        console.log("🎯 doc:changed event received:", {
          hasSnapshot: !!data.yjsSnapshot,
          snapshotSize: data.yjsSnapshot?.length,
          fromClient: data.clientId,
          myClientId: this.socket.id,
        });

        // Don't apply our own changes back (prevent echo)
        if (data.clientId !== this.socket.id && data.yjsSnapshot) {
          try {
            // Validate data size (max 50MB for full state)
            if (!Array.isArray(data.yjsSnapshot)) {
              console.error("Invalid yjsSnapshot: not an array");
              return;
            }
            if (data.yjsSnapshot.length > 50 * 1024 * 1024) {
              console.error(
                `yjsSnapshot too large: ${data.yjsSnapshot.length} bytes (max 50MB)`
              );
              return;
            }

            console.log(
              `💾 Received full state update: ${
                data.yjsSnapshot.length
              } bytes (${(data.yjsSnapshot.length / 1024).toFixed(2)} KB)`
            );

            const update = new Uint8Array(data.yjsSnapshot);
            // Pass 'this' as origin so we don't re-emit this update
            Y.applyUpdate(this.doc, update, this);
          } catch (error) {
            console.error("Failed to apply full state update:", error);
          }
        }
      }
    );

    // Awareness (cursor positions, user presence)
    // Note: Backend sends custom format, not binary awareness updates
    // This is handled by BlockNote's built-in collaboration
    // We don't need to manually apply awareness updates here
  }

  private setupAwarenessSync() {
    // 1. Listen for local cursor changes and emit to server
    this.awareness.on("change", (changes: any, origin: any) => {
      if (origin === "socket") return; // Don't emit if change came from socket

      const localState = this.awareness.getLocalState();
      if (localState) {
        this.socket.emit("doc:cursor", {
          docId: this.docId,
          cursorPosition: localState.cursor || {},
          // We can also send user info if needed, but backend seems to handle it
        });
      }
    });

    // 2. Listen for remote cursor updates from server
    this.socket.on(
      "user:cursor",
      (data: {
        userId: string;
        fullname: string;
        cursorPosition: Record<string, unknown>;
        color: string;
      }) => {
        // Convert userId to a numeric clientID for Yjs Awareness
        const clientId = this.getNumericClientId(data.userId);

        // Construct the awareness state expected by BlockNote
        const state = {
          user: {
            name: data.fullname,
            color: data.color,
          },
          cursor: data.cursorPosition,
        };

        // Update the awareness state for this client
        this.awareness.states.set(clientId, state);

        // Notify listeners (BlockNote) about the change
        this.awareness.emit("change", [
          { added: [clientId], updated: [clientId], removed: [] },
          "socket",
        ]);
      }
    );

    // 3. Handle user leaving (remove cursor)
    this.socket.on("user:left", (data: { userId: string }) => {
      const clientId = this.getNumericClientId(data.userId);

      if (this.awareness.states.has(clientId)) {
        this.awareness.states.delete(clientId);
        this.awareness.emit("change", [
          { added: [], updated: [], removed: [clientId] },
          "socket",
        ]);
      }
    });
  }

  /**
   * Helper to convert string userId to numeric clientId for Yjs Awareness
   */
  private getNumericClientId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.codePointAt(i) || 0;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract plain text from Y.Doc for search/preview
   */
  private extractPlainText(): string {
    try {
      const fragment = this.doc.getXmlFragment("document-store");
      let plainText = "";

      // Iterate through all top-level nodes
      for (let i = 0; i < fragment.length; i++) {
        const node = fragment.get(i);

        if (node) {
          // Get text content recursively
          plainText += this.getNodeText(node) + "\n";
        }
      }

      return plainText.trim();
    } catch (error) {
      console.error("Failed to extract plain text:", error);
      return "";
    }
  }

  /**
   * Recursively extract text from Y.Xml node
   */
  private getNodeText(node: any): string {
    let text = "";

    try {
      // If it's a text node
      if (node.constructor.name === "YXmlText") {
        text += node.toString();
      }
      // If it's an element node with children
      else if (node.constructor.name === "YXmlElement") {
        // Iterate through children
        for (let i = 0; i < node.length; i++) {
          const child = node.get(i);
          if (child) {
            text += this.getNodeText(child);
          }
        }
      }
    } catch (error) {
      console.error("Error extracting node text:", error);
    }

    return text;
  }

  destroy() {
    console.log("🔌 SocketIOProvider destroying...");

    if (this.snapshotTimeout) {
      clearTimeout(this.snapshotTimeout);
    }
    if (this.plainTextTimeout) {
      clearTimeout(this.plainTextTimeout);
    }

    // Remove Y.Doc update listener
    if (this.updateHandler) {
      this.doc.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    this.socket.off("doc:broadcasted");
    this.socket.off("doc:changed");
    this.socket.off("user:cursor");
    this.socket.off("user:left");
    this.awareness.destroy();
    console.log("✅ SocketIOProvider destroyed");
  }
}
