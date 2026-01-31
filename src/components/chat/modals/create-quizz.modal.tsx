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
  Spinner,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import UploadFileButton from "@/components/upload/UploadFileButton";
import UploadService from "@/service/uploadfile.service";
import QuizzService from "@/service/quizz.service";
import { PencilIcon } from "@heroicons/react/16/solid";
import {
  QuizzType,
  InputType,
  QuizzForm,
  QuizzResponse,
  QuizzQuestion,
  QuizzAnswer,
  CreateQuizzModalProps,
} from "@/types/quizz.type";
import { QuizQuestionsList } from "./QuizQuestionsList";

const initialFormState: QuizzForm = {
  inputType: "text",
  quizzType: "single_choice",
  textContent: "",
  file: null,
  numberOfQuestions: "",
  totalScore: "",
};

export const CreateQuizzModal = ({
  isOpen,
  onClose,
  roomId,
  userId,
}: CreateQuizzModalProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<QuizzForm>(initialFormState);
  const [mode, setMode] = useState<"create" | "preview">("create");
  const [quizzData, setQuizzData] = useState<QuizzResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuizz, setEditedQuizz] = useState<QuizzResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Reset form khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setForm(initialFormState);
      setMode("create");
      setQuizzData(null);
      setIsEditing(false);
      setEditedQuizz(null);
      setIsGenerating(false);
      setIsSaving(false);
      setResponseTime(null);
      setError(null);
      setElapsedTime(0);
    }
  }, [isOpen]);

  // Timer để hiển thị thời gian đang chạy
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isGenerating) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 0.1);
      }, 100); // Cập nhật mỗi 100ms
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const quizzTypes: { value: QuizzType; label: string }[] = [
    { value: "single_choice", label: "Trắc nghiệm một lựa chọn" },
    { value: "multiple_choice", label: "Trắc nghiệm nhiều lựa chọn" },
    { value: "true_false", label: "Đúng/Sai" },
    { value: "text", label: "Tự luận" },
  ];

  const generateQuizzWithAi = async () => {
    setIsGenerating(true);
    setResponseTime(null);
    setError(null);
    setElapsedTime(0);
    const startTime = Date.now();
    
    try {
      let submitData: any;
      
      if (form.inputType === "file" && form.file) {
        // Nếu là file, tạo FormData
        const formData = new FormData();
        formData.append("type", "document");
        formData.append("question_type", form.quizzType);
        formData.append("question_max_points", (parseInt(form.totalScore) || 0).toString());
        formData.append("question_max", (parseInt(form.numberOfQuestions) || 0).toString());
        formData.append("file", form.file);
        submitData = formData;
      } else {
        // Nếu là text, gửi JSON
        submitData = {
          type: "document" as const,
          question_type: form.quizzType,
          question_max_points: parseInt(form.totalScore) || 0,
          question_max: parseInt(form.numberOfQuestions) || 0,
          text: form.textContent,
        };
      }
      
      // Gọi API để tạo quizz
      const response = await QuizzService.generateQuizz(submitData);
      
      // Tính thời gian phản hồi
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      setResponseTime(parseFloat(timeTaken));
      
      // Kiểm tra response có hợp lệ không
      if (!response?.data) {
        throw new Error("Không nhận được dữ liệu từ server");
      }
      
      // Sử dụng response từ API - xử lý an toàn
      const responseData = response.data as any;
      const metadata = responseData?.metadata || responseData;
      
      if (!metadata || !metadata.quiz_questions || !Array.isArray(metadata.quiz_questions)) {
        throw new Error("Dữ liệu quizz không hợp lệ");
      }
      
      const quizzResponse: QuizzResponse = {
        quiz_title: metadata.quiz_title || "Quizz",
        quiz_description: metadata.quiz_description || "",
        quiz_status: metadata.quiz_status || "draft",
        quiz_questions: metadata.quiz_questions || [],
      };
      
      setQuizzData(quizzResponse);
      setEditedQuizz(quizzResponse);
      setMode("preview");
      setError(null);
    } catch (error: any) {
      console.error("Error creating quizz:", error);
      // Không chuyển sang preview mode khi có lỗi
      const errorMessage = error?.message || error?.response?.data?.message || "Có lỗi xảy ra khi tạo quizz. Vui lòng thử lại.";
      setError(errorMessage);
      setMode("create"); // Giữ ở chế độ create
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!editedQuizz || !roomId || !userId) {
      setError("Thiếu thông tin roomId hoặc userId");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Chuẩn bị payload theo CreateQuizzPayload
      const payload = {
        quiz_title: editedQuizz.quiz_title,
        quiz_description: editedQuizz.quiz_description,
        quiz_status: (editedQuizz.quiz_status as "draft" | "active") || "draft",
        quiz_roomId: roomId,
        quiz_createdBy: userId,
        quiz_questions: editedQuizz.quiz_questions,
      };
      
      // Gọi API để tạo quizz
      const response = await QuizzService.createQuizz(payload);
      
      // Cập nhật quizz data từ response
      if (response?.data?.metadata || response?.data) {
        const responseData = response.data as any;
        const savedQuizz = responseData?.metadata || responseData;
        
        if (savedQuizz) {
          setQuizzData(savedQuizz);
          setEditedQuizz(savedQuizz);
        }
      }
      
      setIsEditing(false);
      onClose();
    } catch (error: any) {
      console.error("Error saving quizz:", error);
      const errorMessage = error?.message || error?.response?.data?.message || "Có lỗi xảy ra khi lưu quizz. Vui lòng thử lại.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuizzField = useCallback((field: keyof QuizzResponse, value: any) => {
    setEditedQuizz((prev) => prev ? { ...prev, [field]: value } : null);
  }, []);

  const updateQuestion = useCallback((questionIndex: number, field: keyof QuizzQuestion, value: any) => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const updatedQuestions = [...prev.quiz_questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        [field]: value
      };
      return { ...prev, quiz_questions: updatedQuestions };
    });
  }, []);

  const updateAnswer = useCallback((questionIndex: number, answerIndex: number, field: keyof QuizzAnswer, value: any) => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const updatedQuestions = [...prev.quiz_questions];
      const updatedAnswers = [...updatedQuestions[questionIndex].answers];
      updatedAnswers[answerIndex] = {
        ...updatedAnswers[answerIndex],
        [field]: value
      };
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        answers: updatedAnswers
      };
      return { ...prev, quiz_questions: updatedQuestions };
    });
  }, []);

  // Tối ưu: Update tất cả answers trong một lần cho radio buttons
  const updateRadioAnswer = useCallback((questionIndex: number, selectedIndex: number) => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const updatedQuestions = [...prev.quiz_questions];
      const updatedAnswers = updatedQuestions[questionIndex].answers.map((answer, idx) => ({
        ...answer,
        is_correct: idx === selectedIndex
      }));
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        answers: updatedAnswers
      };
      return { ...prev, quiz_questions: updatedQuestions };
    });
  }, []);

  const updateAnswerCount = useCallback((questionIndex: number, newCount: number) => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const question = prev.quiz_questions[questionIndex];
      const currentCount = question.answers.length;
      
      if (newCount < 1) return prev; // Tối thiểu 1 đáp án
      
      const updatedQuestions = [...prev.quiz_questions];
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
      
      return { ...prev, quiz_questions: updatedQuestions };
    });
  }, []);

  const deleteQuestion = useCallback((questionIndex: number) => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const updatedQuestions = prev.quiz_questions.filter(
        (_, index) => index !== questionIndex
      );
      // Cập nhật lại order cho các câu hỏi còn lại
      updatedQuestions.forEach((q, index) => {
        q.order = index + 1;
      });
      return { ...prev, quiz_questions: updatedQuestions };
    });
  }, []);

  const addNewQuestion = useCallback(() => {
    setEditedQuizz((prev) => {
      if (!prev) return null;
      const newOrder = (prev.quiz_questions?.length || 0) + 1;
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
      return {
        ...prev,
        quiz_questions: [...(prev.quiz_questions || []), newQuestion],
      };
    });
  }, []);

  const isFormValid = () => {
    if (form.inputType === "text" && !form.textContent.trim()) return false;
    if (form.inputType === "file" && !form.file) return false;
    if (!form.numberOfQuestions || parseInt(form.numberOfQuestions) <= 0) return false;
    if (!form.totalScore || parseInt(form.totalScore) <= 0) return false;
    return true;
  };

  const updateForm = (key: keyof QuizzForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const displayQuizz = isEditing ? editedQuizz : quizzData;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      scrollBehavior="inside"
      placement="center"
      classNames={{
        base: "m-0",
        wrapper: "p-0",
        body: "p-6",
        header: "p-6",
        footer: "p-6",
      }}
    >
      <ModalContent className="h-screen max-h-screen rounded-none">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg font-semibold">
                  {mode === "create" ? "Tạo quizz với AI" : isEditing ? "Chỉnh sửa quizz" : "Xem trước quizz"}
                </h3>
                {mode === "preview" && (
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="light"
                        startContent={<PencilIcon className="w-4 h-4" />}
                        onPress={() => setIsEditing(true)}
                      >
                        Sửa
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => {
                        if (isEditing) {
                          // Nếu đang sửa, quay về xem trước
                          setIsEditing(false);
                          setEditedQuizz(quizzData);
                        } else {
                          // Nếu đang xem trước, quay về tạo quizz
                          setMode("create");
                        }
                      }}
                    >
                      Trở lại
                    </Button>
                  </div>
                )}
              </div>
            </ModalHeader>
            <ModalBody>
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Spinner size="lg" color="primary" />
                  <p className="text-gray-600">Đang tạo quizz với AI...</p>
                  <p className="text-sm text-gray-500 font-medium">
                    Thời gian đang chạy: {elapsedTime.toFixed(1)}s
                  </p>
                </div>
              )}
              {!isGenerating && mode === "create" ? (
                <>
              {/* Hiển thị lỗi nếu có */}
              {error && (
                <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg mb-4">
                  <p className="text-danger-600 text-sm font-medium">Lỗi: {error}</p>
                </div>
              )}
              {/* Chọn hình thức nhập liệu */}
              <Select
                label="Hình thức nhập liệu"
                selectedKeys={[form.inputType]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as InputType;
                  updateForm("inputType", selected);
                }}
              >
                <SelectItem key="text">Nhập văn bản</SelectItem>
                <SelectItem key="file">Tải lên file</SelectItem>
              </Select>

              {/* Nội dung: Textarea hoặc Upload */}
              {form.inputType === "text" ? (
                <Textarea
                  label="Nội dung quizz"
                  placeholder="Nhập nội dung quizz..."
                  value={form.textContent}
                  onChange={(e) => updateForm("textContent", e.target.value)}
                  minRows={4}
                  maxRows={10}
                />
              ) : (
                <div className="w-full">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        updateForm("file", file);
                      }
                    }}
                    className="hidden"
                    id="quizz-file-input"
                  />
                  <Button
                    variant="bordered"
                    className="w-full"
                    onPress={() => {
                      document.getElementById("quizz-file-input")?.click();
                    }}
                  >
                    {form.file ? form.file.name : "Chọn file quizz"}
                  </Button>
                  {form.file && (
                    <p className="text-sm text-success mt-2">
                      ✓ Đã chọn file: {form.file.name}
                    </p>
                  )}
                </div>
              )}

              {/* Select loại quizz */}
              <Select
                label="Loại quizz"
                selectedKeys={[form.quizzType]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as QuizzType;
                  updateForm("quizzType", selected);
                }}
              >
                {quizzTypes.map((type) => (
                  <SelectItem key={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </Select>

              {/* Số lượng câu hỏi */}
              <Input
                type="number"
                label="Số lượng câu hỏi"
                placeholder="Nhập số lượng câu hỏi"
                value={form.numberOfQuestions}
                onChange={(e) => updateForm("numberOfQuestions", e.target.value)}
                min={1}
              />

              {/* Tổng điểm */}
              <Input
                type="number"
                label="Tổng điểm trắc nghiệm"
                placeholder="Nhập tổng điểm"
                value={form.totalScore}
                onChange={(e) => updateForm("totalScore", e.target.value)}
                min={1}
              />
                </>
              ) : (
                <>
                  {/* Preview Quizz */}
                  {displayQuizz && (
                    <div className="space-y-4">
                      {/* Quiz Title */}
                      {isEditing ? (
                        <Input
                          label="Tiêu đề quizz"
                          value={displayQuizz.quiz_title}
                          onChange={(e) => updateQuizzField("quiz_title", e.target.value)}
                        />
                      ) : (
                        <h2 className="text-xl font-bold">{displayQuizz.quiz_title}</h2>
                      )}

                      {/* Quiz Description */}
                      {isEditing ? (
                        <Textarea
                          label="Mô tả quizz"
                          value={displayQuizz.quiz_description}
                          onChange={(e) => updateQuizzField("quiz_description", e.target.value)}
                          minRows={2}
                        />
                      ) : (
                        <p className="text-gray-600">{displayQuizz.quiz_description}</p>
                      )}

                      {/* Tổng điểm và số câu hỏi */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          <span className="font-semibold text-gray-800">
                            {displayQuizz.quiz_questions.reduce((sum, q) => sum + q.points, 0)}
                          </span>{" "}
                          (điểm)
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className="text-gray-600">
                          <span className="font-semibold text-gray-800">
                            {displayQuizz.quiz_questions.length}
                          </span>{" "}
                          (câu hỏi)
                        </span>
                        {responseTime && (
                          <>
                            <span className="text-gray-400">-</span>
                            <span className="text-gray-600">
                              <span className="font-semibold text-gray-800">
                                {responseTime}s
                              </span>{" "}
                              (thời gian tạo)
                            </span>
                          </>
                        )}
                      </div>

                      <Divider />

                      {/* Quiz Questions */}
                      <QuizQuestionsList
                        questions={displayQuizz.quiz_questions}
                        onUpdateQuestion={updateQuestion}
                        onUpdateAnswer={updateAnswer}
                        onUpdateAnswerCount={updateAnswerCount}
                        onDeleteQuestion={deleteQuestion}
                        onAddQuestion={addNewQuestion}
                        isReadOnly={!isEditing}
                      />
                    </div>
                  )}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              {mode === "create" ? (
                <>
                  <Button 
                    color="danger" 
                    variant="light" 
                    onPress={onClose}
                    isDisabled={isGenerating}
                  >
                    Hủy
                  </Button>
                  <Button
                    color="primary"
                    onPress={generateQuizzWithAi}
                    isDisabled={!isFormValid() || isGenerating}
                    startContent={isGenerating ? <Spinner size="sm" color="white" /> : null}
                  >
                    {isGenerating ? "Đang xử lý..." : "Gửi"}
                  </Button>
                </>
              ) : (
                <>
                  {isEditing ? (
                    <>
                      <Button 
                        color="danger" 
                        variant="light" 
                        onPress={() => {
                          setIsEditing(false);
                          setEditedQuizz(quizzData);
                        }}
                        isDisabled={isSaving}
                      >
                        Hủy
                      </Button>
                      <Button 
                        color="primary" 
                        onPress={handleSave}
                        isLoading={isSaving}
                        isDisabled={isSaving}
                      >
                        {isSaving ? "Đang lưu..." : "Lưu"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        color="danger" 
                        variant="light" 
                        onPress={onClose}
                        isDisabled={isSaving}
                      >
                        Hủy
                      </Button>
                      <Button 
                        color="primary" 
                        onPress={() => {
                          handleSave();
                        }}
                        isLoading={isSaving}
                        isDisabled={isSaving}
                      >
                        {isSaving ? "Đang lưu..." : "Xác nhận"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

