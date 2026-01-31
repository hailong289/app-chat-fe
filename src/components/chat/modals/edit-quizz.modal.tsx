"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  Divider,
} from "@heroui/react";
import { useState, useEffect } from "react";
import QuizzService from "@/service/quizz.service";
import {
  QuizzResponse,
  QuizzQuestion,
  QuizzAnswer,
} from "@/types/quizz.type";
import useToast from "@/hooks/useToast";
import { QuizQuestionsList } from "./QuizQuestionsList";

interface EditQuizzModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz?: QuizzResponse; // Dữ liệu quiz được truyền trực tiếp
  onSuccess?: () => void; // Callback khi cập nhật thành công
}

export const EditQuizzModal = ({
  isOpen,
  onClose,
  quiz,
  onSuccess,
}: EditQuizzModalProps) => {
  const [editedQuizz, setEditedQuizz] = useState<QuizzResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  // Load quizz data từ props khi modal mở
  useEffect(() => {
    if (isOpen && quiz) {
      setEditedQuizz(quiz);
      setError(null);
    }
  }, [isOpen, quiz]);

  // Reset state khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setEditedQuizz(null);
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen]);


  const updateQuizzField = (field: keyof QuizzResponse, value: any) => {
    if (!editedQuizz) return;
    setEditedQuizz((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const updateQuestion = (
    questionIndex: number,
    field: keyof QuizzQuestion,
    value: any
  ) => {
    if (!editedQuizz) return;
    const updatedQuestions = [...editedQuizz.quiz_questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      [field]: value,
    };
    setEditedQuizz((prev) =>
      prev ? { ...prev, quiz_questions: updatedQuestions } : null
    );
  };

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    field: keyof QuizzAnswer,
    value: any
  ) => {
    if (!editedQuizz) return;
    const updatedQuestions = [...editedQuizz.quiz_questions];
    const updatedAnswers = [...updatedQuestions[questionIndex].answers];
    updatedAnswers[answerIndex] = {
      ...updatedAnswers[answerIndex],
      [field]: value,
    };
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      answers: updatedAnswers,
    };
    setEditedQuizz((prev) =>
      prev ? { ...prev, quiz_questions: updatedQuestions } : null
    );
  };

  const addNewQuestion = () => {
    if (!editedQuizz) return;
    const newOrder = (editedQuizz.quiz_questions?.length || 0) + 1;
    const newQuestion: QuizzQuestion = {
      question_text: "",
      question_type: "single_choice",
      points: 1,
      order: newOrder,
      explanation: "",
      answers: [
        {
          answer_text: "",
          is_correct: true,
          points: 0,
        },
        {
          answer_text: "",
          is_correct: false,
          points: 0,
        },
      ],
    };
    setEditedQuizz((prev) =>
      prev
        ? {
            ...prev,
            quiz_questions: [...(prev.quiz_questions || []), newQuestion],
          }
        : null
    );
  };

  const updateAnswerCount = (questionIndex: number, newCount: number) => {
    if (!editedQuizz) return;
    const question = editedQuizz.quiz_questions[questionIndex];
    const currentCount = question.answers.length;
    
    if (newCount < 1) return; // Tối thiểu 1 đáp án
    
    const updatedQuestions = [...editedQuizz.quiz_questions];
    let updatedAnswers = [...question.answers];
    
    if (newCount > currentCount) {
      // Thêm đáp án mới
      const answersToAdd = newCount - currentCount;
      for (let i = 0; i < answersToAdd; i++) {
        updatedAnswers.push({
          answer_text: "",
          is_correct: false,
          points: 0,
        });
      }
    } else if (newCount < currentCount) {
      // Xóa đáp án (từ cuối)
      updatedAnswers = updatedAnswers.slice(0, newCount);
      // Đảm bảo có ít nhất 1 đáp án đúng cho single_choice và true_false
      if (
        (question.question_type === "single_choice" ||
          question.question_type === "true_false") &&
        updatedAnswers.length > 0
      ) {
        const hasCorrect = updatedAnswers.some((a) => a.is_correct);
        if (!hasCorrect) {
          updatedAnswers[0].is_correct = true;
        }
      }
    }
    
    updatedQuestions[questionIndex] = {
      ...question,
      answers: updatedAnswers,
    };
    
    setEditedQuizz((prev) =>
      prev ? { ...prev, quiz_questions: updatedQuestions } : null
    );
  };

  const deleteQuestion = (questionIndex: number) => {
    if (!editedQuizz) return;
    const updatedQuestions = editedQuizz.quiz_questions.filter(
      (_, index) => index !== questionIndex
    );
    // Cập nhật lại order cho các câu hỏi còn lại
    updatedQuestions.forEach((q, index) => {
      q.order = index + 1;
    });
    setEditedQuizz((prev) =>
      prev ? { ...prev, quiz_questions: updatedQuestions } : null
    );
  };

  const handleSave = async () => {
    if (!editedQuizz || !editedQuizz.quiz_id) {
      setError("Thiếu thông tin quizz");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        quiz_title: editedQuizz.quiz_title,
        quiz_description: editedQuizz.quiz_description,
        quiz_status: editedQuizz.quiz_status,
        quiz_questions: editedQuizz.quiz_questions,
      };

      await QuizzService.updateQuizz(editedQuizz.quiz_id, payload);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      console.error("Error updating quiz:", error);
      const errorMessage =
        error?.message ||
        error?.response?.data?.message ||
        "Có lỗi xảy ra khi cập nhật quizz. Vui lòng thử lại.";
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!editedQuizz) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="full"
        classNames={{
          base: "m-0 sm:m-0",
          body: "p-0",
          header: "p-4 border-b",
          footer: "p-4 border-t",
        }}
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Chỉnh sửa quizz
          </ModalHeader>
          <ModalBody>
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500">Không tìm thấy dữ liệu quizz</p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  const totalQuestions = editedQuizz.quiz_questions?.length || 0;
  const totalPoints =
    editedQuizz.quiz_questions?.reduce(
      (sum, q) => sum + (q.points || 0),
      0
    ) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      classNames={{
        base: "m-0 sm:m-0",
        body: "p-0",
        header: "p-4 border-b",
        footer: "p-4 border-t",
      }}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Chỉnh sửa quizz
        </ModalHeader>
        <ModalBody>
          {error && (
            <div className="p-4 bg-danger-50 text-danger rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Quiz Info */}
            <div className="space-y-4">
              <Input
                label="Tiêu đề quizz"
                value={editedQuizz.quiz_title}
                onChange={(e) => updateQuizzField("quiz_title", e.target.value)}
                isRequired
              />

              <Textarea
                label="Mô tả quizz"
                value={editedQuizz.quiz_description}
                onChange={(e) =>
                  updateQuizzField("quiz_description", e.target.value)
                }
                minRows={3}
              />

              <Select
                label="Trạng thái"
                selectedKeys={[editedQuizz.quiz_status]}
                onSelectionChange={(keys) => {
                  const selectedStatus = Array.from(keys)[0] as string;
                  if (selectedStatus) {
                    updateQuizzField("quiz_status", selectedStatus);
                  }
                }}
              >
                <SelectItem key="draft">Bản nháp</SelectItem>
                <SelectItem key="active">Đã xuất</SelectItem>
              </Select>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  <strong>{totalPoints}</strong> (điểm) - <strong>{totalQuestions}</strong> (câu hỏi)
                </span>
              </div>
            </div>

            <Divider />

            {/* Quiz Questions */}
            <QuizQuestionsList
              questions={editedQuizz.quiz_questions}
              onUpdateQuestion={updateQuestion}
              onUpdateAnswer={updateAnswer}
              onUpdateAnswerCount={updateAnswerCount}
              onDeleteQuestion={deleteQuestion}
              onAddQuestion={addNewQuestion}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Hủy
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={isLoading}
            isDisabled={isLoading}
          >
            Lưu thay đổi
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

