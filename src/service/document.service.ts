import apiService from "./api.service";

export interface Document {
  _id: string;
  ownerId: string;
  title: string;
  roomId: string;
  visibility: string;
  yjsSnapshot?: number[] | Uint8Array | string;
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

  async getDocuments(roomId?: string) {
    const params: any = {};
    if (roomId) params.roomId = roomId;

    const response = await apiService.get<{ metadata: Document[] }>(
      this.baseUrl,
      { params }
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

  async updateDocumentContent(
    docId: string,
    data: { plainText?: string; yjsSnapshot?: any }
  ) {
    const response = await apiService.patch<{ metadata: Document }>(
      `${this.baseUrl}/${docId}`,
      data
    );
    return response.data.metadata;
  }

  async deleteDocument(docId: string) {
    await apiService.delete(`${this.baseUrl}/${docId}`);
  }

  async shareDocument(
    docId: string,
    shareUserId: string,
    role: string = "editor"
  ) {
    const response = await apiService.post<{ metadata: Document }>(
      `${this.baseUrl}/${docId}/share`,
      { shareUserId, role }
    );
    return response.data.metadata;
  }

  async unshareDocument(docId: string, shareUserId: string) {
    const response = await apiService.post<{ metadata: Document }>(
      `${this.baseUrl}/${docId}/unshare`,
      { shareUserId }
    );
    return response.data.metadata;
  }

  async updateTitle(docId: string, title: string) {
    const response = await apiService.patch<{ metadata: Document }>(
      `${this.baseUrl}/${docId}/title`,
      { title }
    );
    return response.data.metadata;
  }

  async updateVisibility(docId: string, visibility: string) {
    const response = await apiService.patch<{ metadata: Document }>(
      `${this.baseUrl}/${docId}/visibility`,
      { visibility }
    );
    return response.data.metadata;
  }
}

export default new DocumentService();
