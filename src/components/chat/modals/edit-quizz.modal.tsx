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
  Card,
  CardBody,
  Checkbox,
  Divider,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { useState, useEffect } from "react";
import QuizzService from "@/service/quizz.service";
import {
  QuizzType,
  QuizzResponse,
  QuizzQuestion,
  QuizzAnswer,
} from "@/types/quizz.type";

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
                <SelectItem key="published">Đã xuất bản</SelectItem>
              </Select>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  <strong>{totalPoints}</strong> (điểm) - <strong>{totalQuestions}</strong> (câu hỏi)
                </span>
              </div>
            </div>

            <Divider />

            {/* Quiz Questions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Danh sách câu hỏi</h3>
              {editedQuizz.quiz_questions.map(
                (question: QuizzQuestion, qIndex: number) => (
                  <Card key={qIndex} className="border border-gray-200">
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500">
                            Câu {question.order}
                          </span>
                          <span className="text-sm font-semibold text-primary">
                            ({question.points} điểm)
                          </span>
                        </div>
                        <Input
                          type="number"
                          size="sm"
                          label="Điểm"
                          value={question.points.toString()}
                          onChange={(e) =>
                            updateQuestion(
                              qIndex,
                              "points",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20"
                        />
                      </div>

                      <Textarea
                        label="Câu hỏi"
                        value={question.question_text}
                        onChange={(e) =>
                          updateQuestion(qIndex, "question_text", e.target.value)
                        }
                        minRows={2}
                      />

                      <Select
                        label="Loại câu hỏi"
                        selectedKeys={[question.question_type]}
                        onSelectionChange={(keys) => {
                          const selectedType = Array.from(keys)[0] as QuizzType;
                          if (selectedType) {
                            updateQuestion(qIndex, "question_type", selectedType);
                            // Nếu chuyển sang single_choice hoặc true_false, chỉ giữ 1 đáp án đúng
                            if (
                              selectedType === "single_choice" ||
                              selectedType === "true_false"
                            ) {
                              const currentAnswers = question.answers;
                              const correctIndex = currentAnswers.findIndex(
                                (a: QuizzAnswer) => a.is_correct
                              );
                              // Reset tất cả về false
                              currentAnswers.forEach(
                                (_: QuizzAnswer, idx: number) => {
                                  updateAnswer(qIndex, idx, "is_correct", false);
                                }
                              );
                              // Nếu có đáp án đúng, giữ lại đáp án đầu tiên
                              if (
                                correctIndex >= 0 &&
                                correctIndex < currentAnswers.length
                              ) {
                                updateAnswer(
                                  qIndex,
                                  correctIndex,
                                  "is_correct",
                                  true
                                );
                              } else if (currentAnswers.length > 0) {
                                // Nếu không có đáp án đúng, set đáp án đầu tiên
                                updateAnswer(qIndex, 0, "is_correct", true);
                              }
                            }
                          }
                        }}
                      >
                        <SelectItem key="single_choice">
                          Trắc nghiệm một lựa chọn
                        </SelectItem>
                        <SelectItem key="multiple_choice">
                          Trắc nghiệm nhiều lựa chọn
                        </SelectItem>
                        <SelectItem key="true_false">Đúng/Sai</SelectItem>
                        <SelectItem key="text">Tự luận</SelectItem>
                      </Select>

                      <Textarea
                        label="Giải thích"
                        value={question.explanation}
                        onChange={(e) =>
                          updateQuestion(qIndex, "explanation", e.target.value)
                        }
                        minRows={2}
                      />

                      {/* Answers */}
                      <div className="space-y-2 mt-3">
                        <p className="text-sm font-medium text-gray-600">
                          Đáp án:
                        </p>
                        {question.question_type === "text" ? (
                          // Text type: hiển thị textarea
                          question.answers.map(
                            (answer: QuizzAnswer, aIndex: number) => (
                              <Textarea
                                key={aIndex}
                                label={`Đáp án ${aIndex + 1}`}
                                value={answer.answer_text}
                                onChange={(e) =>
                                  updateAnswer(
                                    qIndex,
                                    aIndex,
                                    "answer_text",
                                    e.target.value
                                  )
                                }
                                minRows={2}
                              />
                            )
                          )
                        ) : question.question_type === "multiple_choice" ? (
                          // Multiple choice: dùng checkbox
                          question.answers.map(
                            (answer: QuizzAnswer, aIndex: number) => (
                              <div
                                key={aIndex}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  isSelected={answer.is_correct}
                                  onValueChange={(checked) =>
                                    updateAnswer(
                                      qIndex,
                                      aIndex,
                                      "is_correct",
                                      checked
                                    )
                                  }
                                />
                                <Input
                                  className="flex-1"
                                  value={answer.answer_text}
                                  onChange={(e) =>
                                    updateAnswer(
                                      qIndex,
                                      aIndex,
                                      "answer_text",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Nhập đáp án"
                                />
                              </div>
                            )
                          )
                        ) : (
                          // Single choice và true_false: dùng radio
                          <RadioGroup
                            value={
                              question.answers.findIndex(
                                (a: QuizzAnswer) => a.is_correct
                              ) >= 0
                                ? question.answers
                                    .findIndex((a: QuizzAnswer) => a.is_correct)
                                    .toString()
                                : undefined
                            }
                            onValueChange={(value) => {
                              // Reset tất cả answers về false
                              question.answers.forEach(
                                (_: QuizzAnswer, idx: number) => {
                                  updateAnswer(qIndex, idx, "is_correct", false);
                                }
                              );
                              // Set answer được chọn thành true
                              const selectedIndex = parseInt(value);
                              if (
                                selectedIndex >= 0 &&
                                selectedIndex < question.answers.length
                              ) {
                                updateAnswer(
                                  qIndex,
                                  selectedIndex,
                                  "is_correct",
                                  true
                                );
                              }
                            }}
                          >
                            {question.answers.map(
                              (answer: QuizzAnswer, aIndex: number) => (
                                <div
                                  key={aIndex}
                                  className="flex items-center gap-2"
                                >
                                  <Radio value={aIndex.toString()} />
                                  <Input
                                    className="flex-1"
                                    value={answer.answer_text}
                                    onChange={(e) =>
                                      updateAnswer(
                                        qIndex,
                                        aIndex,
                                        "answer_text",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Nhập đáp án"
                                  />
                                </div>
                              )
                            )}
                          </RadioGroup>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                )
              )}
            </div>
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

