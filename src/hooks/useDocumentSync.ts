import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Doc, applyUpdate, XmlElement, XmlText } from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";

// Helper to parse various snapshot formats
function parseYjsSnapshot(snapshot: any): Uint8Array | null {
  if (!snapshot) {
    console.log("❌ parseYjsSnapshot: snapshot is null/undefined");
    return null;
  }

  try {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB limit

    console.log("🔍 parseYjsSnapshot input:", {
      type: typeof snapshot,
      isArray: Array.isArray(snapshot),
      isUint8Array: snapshot instanceof Uint8Array,
      isArrayBuffer: snapshot instanceof ArrayBuffer,
      hasDataProperty: snapshot.data !== undefined,
      hasTypeProperty: snapshot.type !== undefined,
      structureType: snapshot.type,
    });

    if (snapshot instanceof Uint8Array) {
      console.log("✅ Already Uint8Array, length:", snapshot.length);
      return snapshot;
    }

    if (snapshot instanceof ArrayBuffer) {
      console.log("✅ Converting ArrayBuffer to Uint8Array");
      return new Uint8Array(snapshot);
    }

    // MongoDB Buffer object: { type: "Buffer", data: [...] }
    if (snapshot.data && Array.isArray(snapshot.data)) {
      console.log(
        "✅ MongoDB Buffer format detected, data length:",
        snapshot.data.length
      );
      if (snapshot.data.length > MAX_SIZE) {
        console.error(`❌ Snapshot too large: ${snapshot.data.length} bytes`);
        return null;
      }
      return new Uint8Array(snapshot.data);
    }

    // Plain array
    if (Array.isArray(snapshot)) {
      console.log("✅ Plain array format, length:", snapshot.length);
      if (snapshot.length > MAX_SIZE) {
        console.error(`❌ Snapshot too large: ${snapshot.length} bytes`);
        return null;
      }
      return new Uint8Array(snapshot);
    }

    console.error("❌ Unknown snapshot format");
    return null;
  } catch (error) {
    console.error("❌ Failed to parse Yjs snapshot:", error);
    return null;
  }
}

// Helper to initialize default content
function initializeDefaultContent(ydoc: Doc) {
  const fragment = ydoc.getXmlFragment("document-store");
  if (fragment.length === 0) {
    ydoc.transact(() => {
      const blockGroup = new XmlElement("blockGroup");
      const blockContainer = new XmlElement("blockContainer");
      const paragraph = new XmlElement("paragraph");
      const textElement = new XmlText();

      paragraph.insert(0, [textElement]);
      blockContainer.insert(0, [paragraph]);
      blockGroup.insert(0, [blockContainer]);
      fragment.insert(0, [blockGroup]);
    });
    console.log("✅ Initialized default content for empty document");
  }
}

interface DocumentMetadata {
  _id: string;
  ownerId: string;
  title: string;
  roomId: string;
  visibility: string;
  yjsSnapshot?: number[] | Uint8Array;
  plainText?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserPresence {
  userId: string;
  fullname: string;
  avatar?: string;
  color?: string;
  cursorPosition?: Record<string, unknown>;
  isTyping?: boolean;
}

interface UseDocumentSyncOptions {
  docId: string;
  socket: Socket | null;
  ydoc: Doc;
  enabled?: boolean;
}

interface UseDocumentSyncReturn {
  document: DocumentMetadata | null;
  usersPresence: Map<string, UserPresence>;
  provider: SocketIOProvider | null;
  isRoomJoined: boolean;
  isSnapshotApplied: boolean;
}

/**
 * Hook tập trung TẤT CẢ logic socket events cho document
 * - Join/leave document room
 * - Document metadata sync
 * - User presence tracking
 * - Yjs collaboration provider
 */
export function useDocumentSync({
  docId,
  socket,
  ydoc,
  enabled = true,
}: UseDocumentSyncOptions): UseDocumentSyncReturn {
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [usersPresence, setUsersPresence] = useState<Map<string, UserPresence>>(
    new Map()
  );
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [isSnapshotApplied, setIsSnapshotApplied] = useState(false);
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);

  // ============================================================
  // DOCUMENT ROOM: Join & Get Metadata
  // ============================================================
  useEffect(() => {
    if (!docId || !socket || !enabled) return;

    console.log("📤 Emitting doc:open for:", docId);
    socket.emit("doc:open", { docId });

    const handleDocOpened = (data: DocumentMetadata) => {
      console.log("✅ Document room joined:", data._id);
      console.log("📋 Document data received:", {
        hasSnapshot: !!data.yjsSnapshot,
        snapshotType: data.yjsSnapshot ? typeof data.yjsSnapshot : "none",
        snapshotStructure: data.yjsSnapshot
          ? (data.yjsSnapshot as any).type || "raw"
          : "none",
        plainText: data.plainText,
      });

      // Apply initial snapshot to Y.Doc BEFORE setting document state
      if (data.yjsSnapshot) {
        try {
          const snapshotData = parseYjsSnapshot(data.yjsSnapshot);
          if (snapshotData) {
            console.log(
              `📥 Applying initial snapshot: ${snapshotData.length} bytes`
            );
            applyUpdate(ydoc, snapshotData);

            // Verify Y.Doc content after applying
            const xmlFragment = ydoc.getXmlFragment("document-store");
            console.log("📄 Y.Doc after snapshot:", {
              fragmentLength: xmlFragment.length,
              fragmentType: xmlFragment.constructor.name,
            });

            setIsSnapshotApplied(true);
          } else {
            console.error("❌ Failed to parse snapshot - returned null");
            initializeDefaultContent(ydoc);
            setIsSnapshotApplied(true); // Allow rendering even if no snapshot
          }
        } catch (error) {
          console.error("❌ Failed to apply initial snapshot:", error);
          initializeDefaultContent(ydoc);
          setIsSnapshotApplied(true); // Allow rendering even on error
        }
      } else {
        console.warn("⚠️ No snapshot data in document response");
        initializeDefaultContent(ydoc);
        setIsSnapshotApplied(true); // No snapshot to apply, proceed
      }

      setDocument(data);
      setIsRoomJoined(true);
    };

    socket.on("doc:opened", handleDocOpened);

    return () => {
      console.log("📤 Emitting doc:close for:", docId);
      socket.off("doc:opened", handleDocOpened);
      socket.emit("doc:close", { docId });
      setIsRoomJoined(false);
      setIsSnapshotApplied(false);
    };
  }, [docId, socket, ydoc, enabled]);

  // ============================================================
  // YJS COLLABORATION PROVIDER
  // ============================================================
  useEffect(() => {
    if (!docId || !socket || !ydoc || !isRoomJoined) {
      return;
    }

    console.log("🔌 Initializing SocketIOProvider for:", docId);
    const newProvider = new SocketIOProvider(docId, ydoc, socket);
    setProvider(newProvider);

    return () => {
      console.log("🔌 Destroying SocketIOProvider for:", docId);
      newProvider.destroy();
      setProvider(null);
    };
  }, [docId, socket, ydoc, isRoomJoined]);

  // ============================================================
  // USER PRESENCE: Track users in room
  // ============================================================
  useEffect(() => {
    if (!socket || !docId || !isRoomJoined) return;

    const handleUserJoined = (data: {
      userId: string;
      fullname: string;
      avatar?: string;
    }) => {
      console.log("👤 User joined:", data.fullname);
      setUsersPresence((prev) => {
        const updated = new Map(prev);
        updated.set(data.userId, {
          userId: data.userId,
          fullname: data.fullname,
          avatar: data.avatar,
        });
        return updated;
      });
    };

    const handleUserLeft = (data: { userId: string; fullname: string }) => {
      console.log("👋 User left:", data.fullname);
      setUsersPresence((prev) => {
        const updated = new Map(prev);
        updated.delete(data.userId);
        return updated;
      });
    };

    const handleUserCursor = (data: {
      userId: string;
      fullname: string;
      cursorPosition: Record<string, unknown>;
      color: string;
    }) => {
      setUsersPresence((prev) => {
        const updated = new Map(prev);
        const user = updated.get(data.userId);
        if (user) {
          updated.set(data.userId, {
            ...user,
            cursorPosition: data.cursorPosition,
            color: data.color,
          });
        }
        return updated;
      });
    };

    const handleUserTyping = (data: {
      userId: string;
      fullname: string;
      isTyping: boolean;
    }) => {
      setUsersPresence((prev) => {
        const updated = new Map(prev);
        const user = updated.get(data.userId);
        if (user) {
          updated.set(data.userId, {
            ...user,
            isTyping: data.isTyping,
          });
        }
        return updated;
      });
    };

    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("user:cursor", handleUserCursor);
    socket.on("user:typing", handleUserTyping);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("user:cursor", handleUserCursor);
      socket.off("user:typing", handleUserTyping);
    };
  }, [socket, docId, isRoomJoined]);

  console.log("🚀 ~ useDocumentSync ~ document:", document);
  return {
    document,
    usersPresence,
    provider,
    isRoomJoined,
    isSnapshotApplied,
  };
}
