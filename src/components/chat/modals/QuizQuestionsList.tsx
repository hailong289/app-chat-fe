"use client";

import {
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  Card,
  CardBody,
  Checkbox,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  QuizzType,
  QuizzQuestion,
  QuizzAnswer,
} from "@/types/quizz.type";

interface QuizQuestionsListProps {
  questions: QuizzQuestion[];
  onUpdateQuestion: (
    questionIndex: number,
    field: keyof QuizzQuestion,
    value: any
  ) => void;
  onUpdateAnswer: (
    questionIndex: number,
    answerIndex: number,
    field: keyof QuizzAnswer,
    value: any
  ) => void;
  onUpdateAnswerCount: (questionIndex: number, newCount: number) => void;
  onDeleteQuestion: (questionIndex: number) => void;
  onAddQuestion: () => void;
  isReadOnly?: boolean;
  /** Callback khi bấm nút Gửi đi */
  onSend?: () => void;
  /** Nếu true, ẩn nút Gửi đi (quiz đã được gửi vào chat) */
  isSent?: boolean;
}

export const QuizQuestionsList = ({
  questions,
  onUpdateQuestion,
  onUpdateAnswer,
  onUpdateAnswerCount,
  onDeleteQuestion,
  onAddQuestion,
  isReadOnly = false,
  onSend,
  isSent = false,
}: QuizQuestionsListProps) => {
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Setup IntersectionObserver cho virtualization
  useEffect(() => {
    if (questions.length === 0) {
      return;
    }

    // Tạo observer mới nếu chưa có
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          setVisibleIndices((prev) => {
            const newSet = new Set(prev);
            entries.forEach((entry) => {
              const index = parseInt(
                entry.target.getAttribute("data-index") || "-1"
              );
              if (index >= 0) {
                if (entry.isIntersecting) {
                  // Luôn add khi intersecting
                  newSet.add(index);
                }
                // Không remove ngay khi không intersecting
                // Logic renderIndices sẽ quyết định items nào cần render dựa trên buffer
              }
            });
            return newSet;
          });
        },
        {
          root: containerRef.current,
          rootMargin: "500px", // Buffer zone lớn để detect items sắp visible
          threshold: 0,
        }
      );
    }

    // Observe tất cả items hiện có
    const observeItems = () => {
      itemRefs.current.forEach((element, index) => {
        if (
          element &&
          observerRef.current &&
          !element.hasAttribute("data-observed")
        ) {
          observerRef.current.observe(element);
          element.setAttribute("data-observed", "true");
        }
      });
    };

    // Ban đầu render một số items đầu tiên
    const initialCount = Math.min(5, questions.length);
    const initialIndices = new Set(
      Array.from({ length: initialCount }, (_, i) => i)
    );
    setVisibleIndices(initialIndices);

    // Observe items sau khi state đã được set
    setTimeout(observeItems, 0);

    return () => {
      // Không disconnect observer khi component update, chỉ disconnect khi unmount
    };
  }, [questions.length]);

  // Cleanup observer khi unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // Callback để set ref cho mỗi item
  const setItemRef = useCallback(
    (index: number, element: HTMLDivElement | null) => {
      if (element) {
        itemRefs.current.set(index, element);
        if (
          observerRef.current &&
          !element.hasAttribute("data-observed")
        ) {
          observerRef.current.observe(element);
          element.setAttribute("data-observed", "true");
        }
      } else {
        const oldElement = itemRefs.current.get(index);
        if (oldElement && observerRef.current) {
          observerRef.current.unobserve(oldElement);
        }
        itemRefs.current.delete(index);
      }
    },
    []
  );

  // Tính toán các indices cần render (visible + buffer)
  const renderIndices = useMemo(() => {
    const total = questions.length;
    if (total === 0) return [];

    if (visibleIndices.size === 0) {
      // Ban đầu render một số items đầu tiên
      const initialCount = Math.min(5, total);
      return Array.from({ length: initialCount }, (_, i) => i);
    }

    const indices = Array.from(visibleIndices);
    if (indices.length === 0) {
      // Fallback: render items đầu tiên
      const initialCount = Math.min(5, total);
      return Array.from({ length: initialCount }, (_, i) => i);
    }

    const min = Math.min(...indices);
    const max = Math.max(...indices);
    const buffer = 10; // Tăng buffer lên 10 items ở trên và dưới để đảm bảo không bị mất

    const result: number[] = [];

    // Render từ min - buffer đến max + buffer
    const startIndex = Math.max(0, min - buffer);
    const endIndex = Math.min(total - 1, max + buffer);

    for (let i = startIndex; i <= endIndex; i++) {
      result.push(i);
    }

    // Đảm bảo luôn có ít nhất items đầu tiên được render (nếu chưa có)
    if (startIndex > 0) {
      const initialCount = Math.min(2, startIndex);
      for (let i = 0; i < initialCount; i++) {
        if (!result.includes(i)) {
          result.push(i);
        }
      }
    }

    // Đảm bảo luôn có items cuối cùng được render (nếu chưa có)
    if (endIndex < total - 1) {
      const lastCount = Math.min(2, total - 1 - endIndex);
      for (let i = total - lastCount; i < total; i++) {
        if (!result.includes(i)) {
          result.push(i);
        }
      }
    }

    return result.sort((a, b) => a - b);
  }, [visibleIndices, questions.length]);

  return (
    <div className="space-y-4" ref={containerRef}>
      <h3 className="font-semibold text-lg">Danh sách câu hỏi</h3>
      {questions.map((question: QuizzQuestion, qIndex: number) => {
        const shouldRender = renderIndices.includes(qIndex);

        if (!shouldRender) {
          // Render placeholder để giữ layout và scroll position
          // Ước tính chiều cao dựa trên số lượng đáp án
          const estimatedHeight = 300 + question.answers.length * 60;
          return (
            <div
              key={qIndex}
              data-index={qIndex}
              ref={(el: HTMLDivElement | null) => setItemRef(qIndex, el)}
              style={{ minHeight: `${estimatedHeight}px` }}
              aria-hidden="true"
              className="border border-transparent"
            />
          );
        }

        return (
          <Card
            key={qIndex}
            ref={(el: HTMLDivElement | null) => setItemRef(qIndex, el)}
            data-index={qIndex}
            className="border border-gray-200"
          >
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
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      size="sm"
                      label="Điểm"
                      value={question.points.toString()}
                      onChange={(e) =>
                        onUpdateQuestion(
                          qIndex,
                          "points",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-20"
                    />
                    <Button
                      color="danger"
                      variant="light"
                      size="sm"
                      isIconOnly
                      onPress={() => onDeleteQuestion(qIndex)}
                      aria-label="Xóa câu hỏi"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </Button>
                  </div>
                )}
              </div>

              {isReadOnly ? (
                <p className="font-medium">{question.question_text}</p>
              ) : (
                <Textarea
                  label="Câu hỏi"
                  value={question.question_text}
                  onChange={(e) =>
                    onUpdateQuestion(qIndex, "question_text", e.target.value)
                  }
                  minRows={2}
                />
              )}

              {!isReadOnly && (
                <Select
                  label="Loại câu hỏi"
                  selectedKeys={[question.question_type]}
                  onSelectionChange={(keys) => {
                    const selectedType = Array.from(keys)[0] as QuizzType;
                    if (selectedType) {
                      onUpdateQuestion(qIndex, "question_type", selectedType);
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
                            onUpdateAnswer(qIndex, idx, "is_correct", false);
                          }
                        );
                        // Nếu có đáp án đúng, giữ lại đáp án đầu tiên
                        if (
                          correctIndex >= 0 &&
                          correctIndex < currentAnswers.length
                        ) {
                          onUpdateAnswer(
                            qIndex,
                            correctIndex,
                            "is_correct",
                            true
                          );
                        } else if (currentAnswers.length > 0) {
                          // Nếu không có đáp án đúng, set đáp án đầu tiên
                          onUpdateAnswer(qIndex, 0, "is_correct", true);
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
              )}

              {isReadOnly ? (
                question.explanation && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                    <strong>Giải thích:</strong> {question.explanation}
                  </div>
                )
              ) : (
                <Textarea
                  label="Giải thích"
                  value={question.explanation}
                  onChange={(e) =>
                    onUpdateQuestion(qIndex, "explanation", e.target.value)
                  }
                  minRows={2}
                />
              )}

              {/* Answers */}
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">
                    Đáp án:
                  </p>
                  {!isReadOnly && question.question_type !== "text" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        onPress={() =>
                          onUpdateAnswerCount(
                            qIndex,
                            question.answers.length - 1
                          )
                        }
                        isDisabled={question.answers.length <= 1}
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        size="sm"
                        value={question.answers.length.toString()}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 1;
                          onUpdateAnswerCount(qIndex, count);
                        }}
                        className="w-16 text-center"
                        min={1}
                      />
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        onPress={() =>
                          onUpdateAnswerCount(
                            qIndex,
                            question.answers.length + 1
                          )
                        }
                      >
                        +
                      </Button>
                    </div>
                  )}
                </div>
                {question.question_type === "text" ? (
                  // Text type
                  isReadOnly ? (
                    question.answers.map(
                      (answer: QuizzAnswer, aIndex: number) => (
                        <div key={aIndex} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm">{answer.answer_text}</p>
                        </div>
                      )
                    )
                  ) : (
                    question.answers.map(
                      (answer: QuizzAnswer, aIndex: number) => (
                        <Textarea
                          key={aIndex}
                          label={`Đáp án ${aIndex + 1}`}
                          value={answer.answer_text}
                          onChange={(e) =>
                            onUpdateAnswer(
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
                  )
                ) : question.question_type === "multiple_choice" ? (
                  // Multiple choice: dùng checkbox
                  question.answers.map(
                    (answer: QuizzAnswer, aIndex: number) => (
                      <div
                        key={aIndex}
                        className="flex items-center gap-2"
                      >
                        {isReadOnly ? (
                          <>
                            <Checkbox isSelected={answer.is_correct} isDisabled />
                            <span className={answer.is_correct ? "text-success font-medium" : ""}>
                              {answer.answer_text}
                            </span>
                          </>
                        ) : (
                          <>
                            <Checkbox
                              isSelected={answer.is_correct}
                              onValueChange={(checked) =>
                                onUpdateAnswer(
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
                                onUpdateAnswer(
                                  qIndex,
                                  aIndex,
                                  "answer_text",
                                  e.target.value
                                )
                              }
                              placeholder="Nhập đáp án"
                            />
                          </>
                        )}
                      </div>
                    )
                  )
                ) : (
                  // Single choice và true_false: dùng radio
                  (() => {
                    const correctIndex = question.answers.findIndex(
                      (a: QuizzAnswer) => a.is_correct
                    );
                    const radioValue = correctIndex >= 0 ? correctIndex.toString() : undefined;
                    
                    return (
                      <RadioGroup
                        value={radioValue}
                        onValueChange={(value) => {
                          if (isReadOnly) return;
                          // Reset tất cả answers về false
                          question.answers.forEach(
                            (_: QuizzAnswer, idx: number) => {
                              onUpdateAnswer(qIndex, idx, "is_correct", false);
                            }
                          );
                          // Set answer được chọn thành true
                          const selectedIndex = parseInt(value);
                          if (
                            selectedIndex >= 0 &&
                            selectedIndex < question.answers.length
                          ) {
                            onUpdateAnswer(
                              qIndex,
                              selectedIndex,
                              "is_correct",
                              true
                            );
                          }
                        }}
                        isDisabled={isReadOnly}
                      >
                        {question.answers.map(
                          (answer: QuizzAnswer, aIndex: number) => (
                            <div
                              key={aIndex}
                              className="flex items-center gap-2"
                            >
                              <Radio value={aIndex.toString()} />
                              {isReadOnly ? (
                                <span className={answer.is_correct ? "text-success font-medium" : ""}>
                                  {answer.answer_text}
                                </span>
                              ) : (
                                <Input
                                  className="flex-1"
                                  value={answer.answer_text}
                                  onChange={(e) =>
                                    onUpdateAnswer(
                                      qIndex,
                                      aIndex,
                                      "answer_text",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Nhập đáp án"
                                />
                              )}
                            </div>
                          )
                        )}
                      </RadioGroup>
                    );
                  })()
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
      {!isReadOnly && (
        <div className="flex justify-center pt-4">
          <Button color="primary" variant="flat" onPress={onAddQuestion}>
            + Thêm câu hỏi
          </Button>
        </div>
      )}
      {onSend && !isSent && (
        <div className="flex justify-end pt-2">
          <Button color="success" onPress={onSend}>
            Gửi đi
          </Button>
        </div>
      )}
    </div>
  );
};

