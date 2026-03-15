"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardBody, Button, Pagination, Chip } from "@heroui/react";
import { AcademicCapIcon, ChartBarIcon, CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { PencilIcon, TrashIcon, PaperAirplaneIcon } from "@heroicons/react/16/solid";
import QuizzService from "@/service/quizz.service";
import { QuizzResponse } from "@/types/quizz.type";
import { EditQuizzModal } from "../modals/edit-quizz.modal";

import { QuizResultsModal } from "../modals/quiz-results.modal";
import { User } from "@/types/auth.type";

interface QuizzListProps {
  roomId?: string;
  refreshTrigger?: boolean; // Trigger để refresh danh sách
  user?: User | null; // User hiện tại được truyền từ parent
  onSendQuiz?: (quiz: QuizzResponse) => void; // Callback khi click nút send
}

export default function QuizzList({
  roomId,
  refreshTrigger,
  user,
  onSendQuiz,
}: QuizzListProps) {
  const [quizzes, setQuizzes] = useState<QuizzResponse[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [openEditQuizzModal, setOpenEditQuizzModal] = useState(false);
  const [openResultsModal, setOpenResultsModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizzResponse | undefined>();
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // Số lượng quizz mỗi trang
  const [total_item, setTotalItem] = useState(0);

  // Kiểm tra xem user hiện tại có phải là người tạo quizz không
  const isQuizCreator = (quiz: QuizzResponse) => {
    if (!user || !quiz.quiz_createdBy) return false;
    // So sánh với cả _id và id (tùy thuộc vào cấu trúc user object)
    return (
      quiz.quiz_createdBy === user._id ||
      quiz.quiz_createdBy === user.id
    );
  };

  // Hàm fetch quizzes tái sử dụng
  const fetchQuizzes = useCallback(async (currentPage: number) => {
    if (!roomId) return;

    setIsLoadingQuizzes(true);
    try {
      const response = await QuizzService.getQuizzes({
        roomId,
        page: currentPage,
        limit,
      });
      const responseData = response?.data as any;
      const metadata = responseData?.metadata as any;
      setQuizzes(metadata?.data || []);
      setTotalItem(metadata?.total_item || 0);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      setQuizzes([]);
      setTotalItem(0);
    } finally {
      setIsLoadingQuizzes(false);
    }
  }, [roomId, limit]);

  const prevRoomAndTrigger = useRef({ roomId, refreshTrigger });
  const skipNextFetchRef = useRef(false);

  // Một effect duy nhất: đổi room/trigger → reset trang 1 và fetch 1 lần; đổi page → fetch page đó
  useEffect(() => {
    if (!roomId) return;

    const prev = prevRoomAndTrigger.current;
    const roomOrTriggerChanged = prev.roomId !== roomId || prev.refreshTrigger !== refreshTrigger;

    if (roomOrTriggerChanged) {
      prevRoomAndTrigger.current = { roomId, refreshTrigger };
      setPage(1);
      fetchQuizzes(1);
      skipNextFetchRef.current = true;
    } else {
      if (skipNextFetchRef.current) {
        skipNextFetchRef.current = false;
        return;
      }
      fetchQuizzes(page);
    }
  }, [roomId, refreshTrigger, page, fetchQuizzes]);

  const handleEdit = (quiz: QuizzResponse) => {
    setSelectedQuiz(quiz);
    setOpenEditQuizzModal(true);
  };

  const handleViewResults = (quiz: QuizzResponse) => {
    setSelectedQuiz(quiz);
    setOpenResultsModal(true);
  };

  const getQuizTimeStatus = (quiz: QuizzResponse) => {
    const now = new Date();
    if (quiz.quiz_endTime && new Date(quiz.quiz_endTime) < now) {
      return { label: "Đã kết thúc", color: "danger" as const };
    }
    if (quiz.quiz_startTime && new Date(quiz.quiz_startTime) > now) {
      return { label: "Chưa bắt đầu", color: "warning" as const };
    }
    if (quiz.quiz_status === "active") {
      return { label: "Đang mở", color: "success" as const };
    }
    return null;
  };

  const handleDelete = async (quizId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa quizz này không?")) {
      try {
        await QuizzService.deleteQuizz(quizId);
        // Refresh danh sách ở trang hiện tại
        // Nếu trang hiện tại không còn item nào sau khi xóa, quay về trang trước
        const currentPage = quizzes.length === 1 && page > 1 ? page - 1 : page;
        setPage(currentPage);
        await fetchQuizzes(currentPage);
      } catch (error) {
        console.error("Error deleting quiz:", error);
        alert("Có lỗi xảy ra khi xóa quizz");
      }
    }
  };

  const handleEditSuccess = () => {
    // Refresh danh sách sau khi chỉnh sửa thành công ở trang hiện tại
    fetchQuizzes(page);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-800 mb-3">Danh sách quizz</h3>
      <div className="space-y-3">
        {isLoadingQuizzes ? (
          <p className="text-center text-gray-500 py-4 text-sm">Đang tải...</p>
        ) : quizzes.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">
            Chưa có quizz nào
          </p>
        ) : (
          quizzes.map((quiz) => {
            const totalQuestions = quiz.quiz_questions?.length || 0;
            const totalPoints =
              quiz.quiz_questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
            const timeStatus = getQuizTimeStatus(quiz);

            return (
              <Card
                key={quiz.quiz_id}
                className="border border-gray-200 hover:shadow-md transition-shadow"
              >
                <CardBody className="p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900 truncate text-sm">
                        {quiz.quiz_title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {timeStatus && (
                          <Chip size="sm" color={timeStatus.color} variant="flat" className="text-[10px]">
                            {timeStatus.label}
                          </Chip>
                        )}
                        {quiz.is_send && (
                          <Chip size="sm" color="primary" variant="flat" className="text-[10px]">
                            Đã gửi
                          </Chip>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {quiz.quiz_description || "Không có mô tả"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <AcademicCapIcon className="w-3.5 h-3.5" />
                        {totalQuestions} câu hỏi
                      </span>
                      <span>
                        <span className="font-semibold">Điểm:</span> {totalPoints}
                      </span>
                    </div>
                    {(quiz.quiz_startTime || quiz.quiz_endTime) && (
                      <div className="space-y-1 mb-3">
                        {quiz.quiz_startTime && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0 text-primary" />
                            <span className="text-gray-400 w-16 shrink-0">Bắt đầu:</span>
                            <span className="font-medium">
                              {new Date(quiz.quiz_startTime).toLocaleString("vi-VN", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                        {quiz.quiz_endTime && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <ClockIcon className="w-3.5 h-3.5 shrink-0 text-danger" />
                            <span className="text-gray-400 w-16 shrink-0">Kết thúc:</span>
                            <span className="font-medium">
                              {new Date(quiz.quiz_endTime).toLocaleString("vi-VN", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                      {/* Nếu đã gửi: nút xem kết quả. Nếu chưa gửi: nút gửi đi */}
                      {quiz.is_send ? (
                        <Button
                          isIconOnly size="sm" variant="light" className="min-w-0 w-7 h-7"
                          onPress={() => handleViewResults(quiz)}
                          aria-label="Xem kết quả" title="Xem kết quả & thành viên"
                        >
                          <ChartBarIcon className="w-4 h-4 text-primary" />
                        </Button>
                      ) : (
                        onSendQuiz && (
                          <Button
                            isIconOnly size="sm" variant="light" className="min-w-0 w-7 h-7"
                            onPress={() => onSendQuiz(quiz)}
                            aria-label="Gửi quizz" title="Gửi vào chat"
                          >
                            <PaperAirplaneIcon className="w-4 h-4 text-gray-400 hover:text-success" />
                          </Button>
                        )
                      )}

                      {isQuizCreator(quiz) && (
                        <>
                          <Button
                            isIconOnly size="sm" variant="light" className="min-w-0 w-7 h-7"
                            onPress={() => handleEdit(quiz)}
                            aria-label="Chỉnh sửa"
                          >
                            <PencilIcon className="w-4 h-4 text-gray-400 hover:text-primary" />
                          </Button>
                          <Button
                            isIconOnly size="sm" variant="light" className="min-w-0 w-7 h-7"
                            onPress={() => quiz.quiz_id && handleDelete(quiz.quiz_id)}
                            aria-label="Xóa"
                          >
                            <TrashIcon className="w-4 h-4 text-gray-400 hover:text-danger" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
      
      {/* Pagination */}
      {!isLoadingQuizzes && quizzes.length > 0 && total_item > limit && (
        <div className="flex justify-center mt-4">
          <Pagination
            total={Math.ceil(total_item / limit)}
            page={page}
            onChange={handlePageChange}
            showControls
            color="primary"
            size="sm"
          />
        </div>
      )}
      
      <EditQuizzModal
        isOpen={openEditQuizzModal}
        onClose={() => {
          setOpenEditQuizzModal(false);
          setSelectedQuiz(undefined);
        }}
        quiz={selectedQuiz}
        roomId={roomId}
        onSuccess={handleEditSuccess}
      />


      {selectedQuiz && (
        <QuizResultsModal
          isOpen={openResultsModal}
          onClose={() => {
            setOpenResultsModal(false);
            setSelectedQuiz(undefined);
          }}
          quiz={selectedQuiz}
        />
      )}
    </div>
  );
}

