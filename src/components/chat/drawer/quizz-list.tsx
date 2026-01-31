"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardBody, Button, Pagination } from "@heroui/react";
import { AcademicCapIcon } from "@heroicons/react/24/outline";
import { PencilIcon, TrashIcon, PaperAirplaneIcon } from "@heroicons/react/16/solid";
import QuizzService from "@/service/quizz.service";
import { QuizzResponse } from "@/types/quizz.type";
import { EditQuizzModal } from "../modals/edit-quizz.modal";
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

  // Reset về trang 1 khi roomId hoặc refreshTrigger thay đổi
  useEffect(() => {
    if (roomId) {
      setPage(1);
    }
  }, [roomId, refreshTrigger]);

  // Fetch quizzes khi page hoặc roomId/refreshTrigger thay đổi
  useEffect(() => {
    if (roomId) {
      fetchQuizzes(page);
    }
  }, [page, roomId, refreshTrigger, fetchQuizzes]);

  const handleEdit = (quiz: QuizzResponse) => {
    setSelectedQuiz(quiz);
    setOpenEditQuizzModal(true);
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
              quiz.quiz_questions?.reduce(
                (sum, q) => sum + (q.points || 0),
                0
              ) || 0;
            const statusColor =
              quiz.quiz_status === "active"
                ? "text-success"
                : quiz.quiz_status === "draft"
                ? "text-warning"
                : "text-gray-500";
            const statusText =
              quiz.quiz_status === "active"
                ? "Đã xuất bản"
                : quiz.quiz_status === "draft"
                ? "Bản nháp"
                : quiz.quiz_status || "Chưa xác định";

            return (
              <Card
                key={quiz.quiz_id}
                className="border border-gray-200 hover:shadow-md transition-shadow"
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {quiz.quiz_title}
                        </h4>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-100 ${statusColor} whitespace-nowrap flex-shrink-0`}
                        >
                          {statusText}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {quiz.quiz_description || "Không có mô tả"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <AcademicCapIcon className="w-4 h-4" />
                          {totalQuestions} câu hỏi
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-semibold">Tổng điểm:</span>
                          {totalPoints}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        {onSendQuiz && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="min-w-0 w-7 h-7"
                            onPress={() => onSendQuiz(quiz)}
                            aria-label="Gửi quizz"
                          >
                            <PaperAirplaneIcon className="w-4 h-4 text-gray-400 hover:text-success" />
                          </Button>
                        )}
                        {isQuizCreator(quiz) && (
                          <>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="min-w-0 w-7 h-7"
                              onPress={() => handleEdit(quiz)}
                              aria-label="Chỉnh sửa quizz"
                            >
                              <PencilIcon className="w-4 h-4 text-gray-400 hover:text-primary" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="min-w-0 w-7 h-7"
                              onPress={() => quiz.quiz_id && handleDelete(quiz.quiz_id)}
                              aria-label="Xóa quizz"
                            >
                              <TrashIcon className="w-4 h-4 text-gray-400 hover:text-danger" />
                            </Button>
                          </>
                        )}
                      </div>
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
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

