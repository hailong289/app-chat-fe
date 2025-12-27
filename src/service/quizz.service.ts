import ApiResponse from "@/types/api.type";
import apiService from "./api.service";
import { QuizzResponse } from "@/types/quizz.type";

interface GenerateQuizzPayload {
  type: "document";
  question_type: "single_choice" | "multiple_choice" | "true_false" | "text";
  question_max_points: number;
  question_max: number;
  text?: string; // Nếu inputType là "text"
  file?: File; // Nếu inputType là "file" (MulterFile - File object)
}

interface CreateQuizzPayload {
  quiz_title: string;
  quiz_description: string;
  quiz_status: "draft" | "published";
  quiz_roomId: string;
  quiz_createdBy: string;
  quiz_questions: QuizzResponse["quiz_questions"];
}

interface UpdateQuizzPayload {
  quiz_title?: string;
  quiz_description?: string;
  quiz_status?: string;
  quiz_questions?: QuizzResponse["quiz_questions"];
}

export default class QuizzService {
  /**
   * Tạo quizz mới với AI
   */
  static generateQuizz(body: GenerateQuizzPayload) {
    return apiService.post<ApiResponse<QuizzResponse>>("/ai/quizz", body);
  }

  static createQuizz(body: CreateQuizzPayload) {
    return apiService.post<ApiResponse<QuizzResponse>>("/ai/quizz/create", body);
  }

  /**
   * Cập nhật quizz đã tạo
   */
  static updateQuizz(quizzId: string, body: UpdateQuizzPayload) {
    return apiService.patch<QuizzResponse>(`/ai/quizz/update/${quizzId}`, body);
  }

  /**
   * Lấy thông tin quizz theo ID
   */
  static getQuizz(quizzId: string) {
    return apiService.get<QuizzResponse>(`/ai/quizz/${quizzId}`);
  }

  /**
   * Lấy danh sách quizz trong room
   */
  static getQuizzes(queryParams: { roomId: string; page: number; limit: number }) {
    return apiService.get<ApiResponse<QuizzResponse[]>>(`/ai/quizz/list`, queryParams);
  }

  /**
   * Xóa quizz
   */
  static deleteQuizz(quizzId: string) {
    return apiService.delete(`/ai/quizz/delete/${quizzId}`);
  }

  /**
   * Lấy danh sách quizz của user
   */
  static getMyQuizzes(queryParams?: { page?: number; limit?: number; status?: string }) {
    return apiService.get<{ quizzes: QuizzResponse[]; total: number }>("/quizz/my", queryParams);
  }
}

