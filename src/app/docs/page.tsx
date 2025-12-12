"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { Avatar, Select, SelectItem } from "@heroui/react";
import useRoomStore from "@/store/useRoomStore";
import useDocumentStore from "@/store/useDocumentStore";

export default function DocumentsListPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const {
    documents,
    loading,
    creating,
    loadDocuments,
    createDocument,
    deleteDocument,
  } = useDocumentStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    const newDoc = await createDocument({
      title: newDocTitle.trim(),
      visibility: "private",
      roomId: selectedRoomId || undefined,
    });

    if (newDoc) {
      setShowCreateModal(false);
      setNewDocTitle("");
      setSelectedRoomId("");
      router.push(`/docs/${newDoc._id}`);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    await deleteDocument(docId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Documents</h1>
            <p className="text-gray-600 mt-2">
              Manage and collaborate on your documents
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create New Document
          </button>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No documents yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first document to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Create Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden group"
              >
                <button
                  onClick={() => router.push(`/docs/${doc._id}`)}
                  className="p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(
                          doc.updatedAt || doc.createdAt || ""
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    {(() => {
                      let visibilityClass = "";
                      if (doc.visibility === "private") {
                        visibilityClass = "bg-gray-100 text-gray-700";
                      } else if (doc.visibility === "shared") {
                        visibilityClass = "bg-blue-100 text-blue-700";
                      } else {
                        visibilityClass = "bg-green-100 text-green-700";
                      }
                      return (
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${visibilityClass}`}
                        >
                          {doc.visibility}
                        </span>
                      );
                    })()}
                  </div>

                  {doc.plainText && (
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {doc.plainText}
                    </p>
                  )}
                </button>

                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-t">
                  <span className="text-xs text-gray-500">
                    {doc.ownerId === currentUser?._id ? "Owner" : "Shared"}
                  </span>
                  {doc.ownerId === currentUser?._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc._id);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 flex flex-col gap-2">
              <h2 className="text-2xl font-bold mb-4">Create New Document</h2>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="tên tài liệu"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateDocument();
                  if (e.key === "Escape") setShowCreateModal(false);
                }}
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDocument}
                  disabled={!newDocTitle.trim() || creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
