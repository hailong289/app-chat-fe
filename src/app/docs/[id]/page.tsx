"use client";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDocSocket } from "@/hooks/useDocSocket";
import useAuthStore from "@/store/useAuthStore";
import Link from "next/link";
import { DynamicEditor } from "@/components/docs/DynamicEditor";

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

export default function DocumentEditorPage() {
  const params = useParams();
  const docId = params?.id as string;
  const { socket, status } = useDocSocket();
  const currentUser = useAuthStore((s) => s.user);
  const [editor, setEditor] = useState<any>(null);
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [usersPresence, setUsersPresence] = useState<Map<string, UserPresence>>(
    new Map()
  );

  // Open document và nhận metadata
  useEffect(() => {
    if (!docId || !socket || status !== "connected" || !currentUser) return;

    socket.emit("doc:open", { docId }, (response: any) => {
      if (response?.ok && response?.document) {
        setDocument(response.document);
      }
    });

    return () => {
      socket.emit("doc:close", { docId });
    };
  }, [docId, socket, status, currentUser]);

  // Lắng nghe user presence events
  useEffect(() => {
    if (!socket || !docId) return;

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

    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
    };
  }, [socket, docId]);

  if (!document) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="border-b bg-gray-50 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/docs"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                ← Back to Documents
              </Link>
              <div>
                <h1 className="text-3xl font-bold">{document.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Document ID: {docId}
                </p>
              </div>
            </div>

            {/* Active Users */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Active users: {usersPresence.size + 1}
              </span>
              <div className="flex -space-x-2">
                {Array.from(usersPresence.values())
                  .slice(0, 3)
                  .map((user) => (
                    <div
                      key={user.userId}
                      className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: user.color || "#ccc",
                      }}
                      title={user.fullname}
                    >
                      {user.fullname[0]}
                    </div>
                  ))}
                <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white">
                  {currentUser?.fullname?.[0] || "?"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="p-8">
          <div className="border rounded-lg overflow-hidden shadow-sm">
            <DynamicEditor
              onEditorReady={setEditor}
              docId={docId}
              socket={socket}
              userName={currentUser?.fullname || "Anonymous"}
              userColor="#0066ff"
              initialYjsSnapshot={document.yjsSnapshot}
            />
          </div>
        </div>

        {/* Users List */}
        <div className="border-t bg-gray-50 p-4">
          <h3 className="font-semibold mb-2">Active Users</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Current User */}
            <div className="text-sm p-2 bg-blue-100 rounded">
              <div className="font-medium">{currentUser?.fullname}</div>
              <div className="text-xs text-gray-600">You</div>
            </div>

            {/* Other Users */}
            {Array.from(usersPresence.values()).map((user) => (
              <div
                key={user.userId}
                className="text-sm p-2 bg-gray-100 rounded"
              >
                <div className="font-medium" style={{ color: user.color }}>
                  {user.fullname}
                  {user.isTyping && (
                    <span className="ml-2 text-xs">
                      <span className="animate-pulse">✏️ typing...</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">{user.userId}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
