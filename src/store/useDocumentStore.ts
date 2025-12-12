import { create } from "zustand";
import documentService, {
  Document,
  CreateDocumentDto,
} from "@/service/document.service";

interface DocumentState {
  documents: Document[];
  loading: boolean;
  creating: boolean;

  loadDocuments: (roomId?: string) => Promise<void>;
  getDocument: (docId: string) => Promise<Document | null>;
  createDocument: (data: CreateDocumentDto) => Promise<Document | null>;
  duplicateDocument: (docId: string) => Promise<Document | null>;
  deleteDocument: (docId: string) => Promise<void>;
  updateDocumentContent: (
    docId: string,
    data: { plainText?: string; yjsSnapshot?: any }
  ) => Promise<void>;
  shareDocument: (
    docId: string,
    shareUserId: string,
    role?: string
  ) => Promise<Document | null>;
  unshareDocument: (docId: string, shareUserId: string) => Promise<Document | null>;
  updateTitle: (docId: string, title: string) => Promise<Document | null>;
  updateVisibility: (docId: string, visibility: string) => Promise<Document | null>;
}

const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  loading: false,
  creating: false,

  loadDocuments: async (roomId?: string) => {
    set({ loading: true });
    try {
      const docs = await documentService.getDocuments(roomId);
      set({ documents: docs });
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      set({ loading: false });
    }
  },

  getDocument: async (docId) => {
    try {
      const doc = await documentService.getDocument(docId);
      // Optionally update the list if the document exists in it
      set((state) => {
        const exists = state.documents.find((d) => d._id === docId);
        if (exists) {
          return {
            documents: state.documents.map((d) =>
              d._id === docId ? doc : d
            ),
          };
        }
        // If we want to add it to the list even if not loaded via loadDocuments:
        // return { documents: [...state.documents, doc] };
        return {};
      });
      return doc;
    } catch (error) {
      console.error("Failed to get document:", error);
      return null;
    }
  },

  createDocument: async (data) => {
    set({ creating: true });
    try {
      const newDoc = await documentService.createDocument(data);
      set((state) => ({ documents: [newDoc, ...state.documents] }));
      return newDoc;
    } catch (error) {
      console.error("Failed to create document:", error);
      return null;
    } finally {
      set({ creating: false });
    }
  },

  duplicateDocument: async (docId) => {
    try {
      const newDoc = await documentService.duplicateDocument(docId);
      set((state) => ({ documents: [newDoc, ...state.documents] }));
      return newDoc;
    } catch (error) {
      console.error("Failed to duplicate document:", error);
      return null;
    }
  },

  deleteDocument: async (docId) => {
    try {
      await documentService.deleteDocument(docId);
      set((state) => ({
        documents: state.documents.filter((doc) => doc._id !== docId),
      }));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  },

  updateDocumentContent: async (docId, data) => {
    try {
      await documentService.updateDocumentContent(docId, data);
    } catch (error) {
      console.error("Failed to update document content:", error);
    }
  },

  shareDocument: async (docId, shareUserId, role) => {
    try {
      const updatedDoc = await documentService.shareDocument(
        docId,
        shareUserId,
        role
      );
      set((state) => ({
        documents: state.documents.map((d) =>
          d._id === docId ? updatedDoc : d
        ),
      }));
      return updatedDoc;
    } catch (error) {
      console.error("Failed to share document:", error);
      return null;
    }
  },

  unshareDocument: async (docId, shareUserId) => {
    try {
      const updatedDoc = await documentService.unshareDocument(
        docId,
        shareUserId
      );
      set((state) => ({
        documents: state.documents.map((d) =>
          d._id === docId ? updatedDoc : d
        ),
      }));
      return updatedDoc;
    } catch (error) {
      console.error("Failed to unshare document:", error);
      return null;
    }
  },

  updateTitle: async (docId, title) => {
    try {
      const updatedDoc = await documentService.updateTitle(docId, title);
      set((state) => ({
        documents: state.documents.map((d) =>
          d._id === docId ? updatedDoc : d
        ),
      }));
      return updatedDoc;
    } catch (error) {
      console.error("Failed to update title:", error);
      return null;
    }
  },

  updateVisibility: async (docId, visibility) => {
    try {
      const updatedDoc = await documentService.updateVisibility(
        docId,
        visibility
      );
      set((state) => ({
        documents: state.documents.map((d) =>
          d._id === docId ? updatedDoc : d
        ),
      }));
      return updatedDoc;
    } catch (error) {
      console.error("Failed to update visibility:", error);
      return null;
    }
  },
}));

export default useDocumentStore;
