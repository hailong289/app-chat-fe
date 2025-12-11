import { create } from "zustand";
import documentService, {
  Document,
  CreateDocumentDto,
} from "@/service/document.service";

interface DocumentState {
  documents: Document[];
  loading: boolean;
  creating: boolean;

  loadDocuments: () => Promise<void>;
  createDocument: (data: CreateDocumentDto) => Promise<Document | null>;
  deleteDocument: (docId: string) => Promise<void>;
}

const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  loading: false,
  creating: false,

  loadDocuments: async () => {
    set({ loading: true });
    try {
      const docs = await documentService.getDocuments();
      set({ documents: docs });
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      set({ loading: false });
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
}));

export default useDocumentStore;
