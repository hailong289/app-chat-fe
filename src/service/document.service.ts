import apiService from "./api.service";

export interface Document {
  _id: string;
  ownerId: string;
  title: string;
  roomId: string;
  visibility: string;
  yjsSnapshot?: number[] | Uint8Array;
  plainText?: string;
  sharedWith?: Array<{ userId: string; role: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDocumentDto {
  title: string;
  roomId?: string;
  visibility?: "private" | "shared" | "public";
}

class DocumentService {
  private readonly baseUrl = "/documents";

  async getDocuments() {
    const response = await apiService.get<{ metadata: Document[] }>(
      this.baseUrl
    );
    return response.data.metadata || [];
  }

  async getDocument(docId: string) {
    const response = await apiService.get<{ metadata: Document }>(
      `${this.baseUrl}/${docId}`
    );
    return response.data.metadata;
  }

  async createDocument(data: CreateDocumentDto) {
    const response = await apiService.post<{ metadata: Document }>(
      this.baseUrl,
      data
    );
    return response.data.metadata;
  }

  async updateDocument(docId: string, data: Partial<CreateDocumentDto>) {
    const response = await apiService.patch<{ metadata: Document }>(
      `${this.baseUrl}/${docId}`,
      data
    );
    return response.data.metadata;
  }

  async deleteDocument(docId: string) {
    await apiService.delete(`${this.baseUrl}/${docId}`);
  }
}

export default new DocumentService();
