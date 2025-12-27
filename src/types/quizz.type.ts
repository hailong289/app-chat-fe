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
  quiz_id?: string;
  quiz_title: string;
  quiz_description: string;
  quiz_status: string;
  quiz_questions: QuizzQuestion[];
  quiz_createdBy?: string; // ID của người tạo quizz
  roomId?: string;
  createdAt?: string;
  updatedAt?: string;
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

