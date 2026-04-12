export type QuizzType = "single_choice" | "multiple_choice" | "true_false" | "text";
export type InputType = "text" | "file";

export interface QuizzAnswer {
  answer_text: string;
  is_correct: boolean;
  points: number;
}

export interface QuizzQuestion {
  question_text: string;
  question_type: QuizzType;
  points: number;
  order: number;
  explanation: string;
  answers: QuizzAnswer[];
}

export interface QuizzResponse {
  id?: string;
  _id?: string;
  quiz_id?: string;
  quiz_title: string;
  quiz_description: string;
  quiz_status: string;
  quiz_questions: QuizzQuestion[];
  quiz_createdBy?: string;
  quiz_startTime?: string; // ISO string
  quiz_endTime?: string;   // ISO string
  quiz_allowRetake?: boolean;
  quiz_maxAttempts?: number;
  roomId?: string;
  createdAt?: string;
  updatedAt?: string;
  quiz_results?: QuizResultResponse[]; // kết quả đã nộp
  is_send?: boolean; // đã gửi vào chat chưa
  quiz_roomId?: string;
}

export interface QuizzForm {
  inputType: InputType;
  quizzType: QuizzType;
  textContent: string;
  file: File | null; // Lưu File object thay vì URL
  numberOfQuestions: string;
  totalScore: string;
}

export interface CreateQuizzModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  userId?: string;
}

export interface QuizzUserAnswer {
  questionIndex: number;
  selectedAnswers: number[]; // indices of selected answers
  textAnswer?: string; // for text type
}

/** UserAnswer subdocument — khớp backend schema */
export interface UserAnswerPayload {
  question_index: number;
  selected_answer_indices: number[]; // Index các đáp án đã chọn
  text_answer: string;               // Câu trả lời text (hoặc '')
  is_correct: boolean;
  points_earned: number;
  answered_at: string; // ISO
}

/** Payload gửi lên backend khi nộp bài */
export interface SubmitQuizResultPayload {
  user_answers: UserAnswerPayload[];
  total_score: number;
  max_score: number;
  correct_count: number;
  total_questions: number;
  started_at: string;   // ISO
  completed_at: string; // ISO
  time_taken: number;   // seconds
  is_completed: boolean;
  is_submitted: boolean;
}

/** Entry trong leaderboard trả về từ backend */
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  correct_count: number;
  total_score: number;
  max_score: number;
  time_taken: number;
  is_completed: boolean;
}

/** Response shape của GET /ai/quizz/:quizId/results */
export interface QuizResultsListResponse {
  message: string;
  statusCode: number;
  metadata: {
    results: QuizResultResponse[];
    leaderboard: LeaderboardEntry[];
    my_result?: QuizResultResponse;
    quiz_id: string;
    quiz_title: string;
    total_participants: number;
    total_submissions: number;
  };
}

/** Kết quả trả về từ backend (QuizResult schema) */
export interface QuizResultResponse {
  _id?: string;
  user_id: string;
  user_answers: UserAnswerPayload[];
  total_score: number;
  max_score: number;
  correct_count: number;
  total_questions: number;
  started_at: string;
  completed_at: string | null;
  time_taken: number;
  is_completed: boolean;
  is_submitted: boolean;
  quiz?: QuizzResponse;
}

/** Entry dùng để hiển thị leaderboard (local hoặc map từ API) */
export interface QuizzScoreEntry {
  userId: string;
  fullname: string;
  avatar?: string;
  score: number;
  totalScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string; // ISO string
  timeTaken?: number;  // seconds
}

export interface TakeQuizzModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: QuizzResponse;
  userId: string;
  userFullname: string;
  userAvatar?: string;
  /** Nếu true, modal mở thẳng phase "result" và fetch kết quả từ server */
  hasCompleted?: boolean;
}

