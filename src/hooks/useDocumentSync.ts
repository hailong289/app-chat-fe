import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Doc, applyUpdate, XmlElement, XmlText } from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";

// Helper to parse various snapshot formats
function parseYjsSnapshot(snapshot: any): Uint8Array | null {
  if (!snapshot) {
    return null;
  }

  try {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB limit

    if (snapshot instanceof Uint8Array) {
      return snapshot;
    }

    if (snapshot instanceof ArrayBuffer) {
      return new Uint8Array(snapshot);
    }

    // MongoDB Buffer object: { type: "Buffer", data: [...] }
    if (snapshot.data && Array.isArray(snapshot.data)) {
      if (snapshot.data.length > MAX_SIZE) {
        console.error(`❌ Snapshot too large: ${snapshot.data.length} bytes`);
        return null;
      }
      return new Uint8Array(snapshot.data);
    }

    // Plain array
    if (Array.isArray(snapshot)) {
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
  }
}

interface DocumentMetadata {
  _id: string;
  ownerId: string;
  title: string;
  roomIds: string[];
  visibility: string;
  yjsSnapshot?: number[] | Uint8Array;
  plainText?: string;
  sharedWith?: Array<{
    userId: string;
    role: string;
    sharedAt: string;
    user: any;
  }>;
  attachmentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  owner?: any;
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
  setDocument: React.Dispatch<React.SetStateAction<DocumentMetadata | null>>;
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

    socket.emit("doc:open", { docId });

    const handleDocOpened = (data: DocumentMetadata) => {
      // Support ?reset=1 query param to skip applying the stored snapshot —
      // lets users recover docs whose saved Yjs state was created with an
      // older BlockNote version and is incompatible with the current schema.
      const shouldReset =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("reset") === "1";

      if (shouldReset) {
        console.warn("⚠️ reset=1 query param detected — skipping saved snapshot and starting fresh");
        initializeDefaultContent(ydoc);
        setIsSnapshotApplied(true);
      } else if (data.yjsSnapshot) {
        try {
          const snapshotData = parseYjsSnapshot(data.yjsSnapshot);
          if (snapshotData) {
            applyUpdate(ydoc, snapshotData);
            setIsSnapshotApplied(true);
          } else {
            console.error("❌ Failed to parse snapshot - returned null");
            initializeDefaultContent(ydoc);
            setIsSnapshotApplied(true);
          }
        } catch (error) {
          console.error("❌ Failed to apply initial snapshot:", error);
          initializeDefaultContent(ydoc);
          setIsSnapshotApplied(true);
        }
      } else {
        console.warn("⚠️ No snapshot data in document response");
        initializeDefaultContent(ydoc);
        setIsSnapshotApplied(true);
      }

      setDocument(data);
      setIsRoomJoined(true);
    };

    socket.on("doc:opened", handleDocOpened);

    return () => {
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

    const newProvider = new SocketIOProvider(docId, ydoc, socket);
    setProvider(newProvider);

    return () => {
      newProvider.destroy();
      // Do NOT setProvider(null) here. In React Strict Mode dev double-invoke,
      // this would flap provider null→instance→null→instance, causing BlockNote
      // to recreate its editor and reset the Yjs UndoManager (undo stack lost).
      // The next effect run replaces provider atomically via setProvider(new).
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

  return {
    document,
    setDocument,
    usersPresence,
    provider,
    isRoomJoined,
    isSnapshotApplied,
  };
}
