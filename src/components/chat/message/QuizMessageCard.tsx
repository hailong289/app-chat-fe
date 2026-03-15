"use client";

import { useState, useEffect, useRef } from "react";
import { Chip } from "@heroui/react";
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { EditQuizzModal } from "@/components/chat/modals/edit-quizz.modal";
import { QuizResultsModal } from "@/components/chat/modals/quiz-results.modal";
import { TakeQuizzModal } from "@/components/chat/modals/take-quizz.modal";
import {
  formatDateTime,
  formatTimeUntil,
  getMsUntilNextTransition,
  getMsUntilStart,
  getQuizStatus,
} from "@/libs/helpers";
import { QuizzResponse, QuizResultResponse } from "@/types/quizz.type";
import { User } from "@/types/auth.type";

interface QuizMessageCardProps {
  quiz: QuizzResponse;
  currentUser: User | null;
  /** True nếu user hiện tại là người gửi quiz (chỉ xem kết quả, không làm bài) */
  isSender?: boolean;
  /** roomId để mở modal sửa quiz và cập nhật message */
  roomId?: string;
}

const TICK_NORMAL_MS = 60_000;   // bình thường: cập nhật mỗi phút
const TICK_LAST_MINUTE_MS = 1_000; // còn ≤1 phút: cập nhật mỗi giây
const LAST_MINUTE_MS = 60_000;

export function QuizMessageCard({ quiz, currentUser, isSender = false, roomId }: QuizMessageCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openResultsModal, setOpenResultsModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [, setTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer chạy nền: còn >1 phút → tick mỗi phút; còn ≤1 phút → tick mỗi giây
  useEffect(() => {
    if (!quiz.quiz_startTime && !quiz.quiz_endTime) return;

    function schedule() {
      const ms = getMsUntilNextTransition(quiz);
      if (ms === Infinity || ms <= 0) return;
      const delay = ms <= LAST_MINUTE_MS ? TICK_LAST_MINUTE_MS : Math.min(TICK_NORMAL_MS, ms);
      timeoutRef.current = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [quiz.quiz_startTime, quiz.quiz_endTime]);

  const quizId = quiz._id ?? quiz.quiz_id;
  const totalQuestions = quiz.quiz_questions?.length ?? 0;
  const totalPoints =
    quiz.quiz_questions?.reduce((s, q) => s + (q.points ?? 0), 0) ?? 0;
  const status = getQuizStatus(quiz);
  const isEnded = status.color === "danger";
  const isNotStarted = status.label === "Chưa bắt đầu";
  const msUntilStart = getMsUntilStart(quiz.quiz_startTime);
  const timeUntilStartLabel = isNotStarted && msUntilStart > 0 ? formatTimeUntil(msUntilStart) : null;
  // Đã bắt đầu: không có quiz_startTime hoặc thời điểm bắt đầu đã qua
  const isStarted = !quiz.quiz_startTime || new Date(quiz.quiz_startTime) <= new Date();

  // Tìm kết quả của user hiện tại từ dữ liệu được truyền vào
  const myResult: QuizResultResponse | undefined = quiz.quiz_results?.find(
    (r) => r.user_id === currentUser?._id
  );
  const hasCompleted = !!myResult?.is_submitted;

  // Điểm hiển thị trên card
  const myScore = myResult?.total_score ?? 0;
  const myMaxScore = myResult?.max_score ?? totalPoints;
  const myPct = myMaxScore > 0 ? Math.round((myScore / myMaxScore) * 100) : 0;
  const scoreColor =
    myPct >= 80 ? "text-success" : myPct >= 50 ? "text-warning" : "text-danger";

  // Người gửi: luôn cho xem kết quả; người khác: làm bài khi đã bắt đầu/chưa kết thúc, hoặc xem kết quả nếu đã làm
  const canOpen = (isSender || (isStarted && !isEnded) || hasCompleted) && !!quizId;
  const showAsViewResults = isSender || hasCompleted;
  const senderCanEdit = isSender && isNotStarted && !!roomId && !!quiz.quiz_id;

  const handleOpen = () => {
    if (!canOpen) return;
    if (isSender) setOpenResultsModal(true);
    else setIsOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenEditModal(true);
  };

  return (
    <>
      <div
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={canOpen ? handleOpen : undefined}
        onKeyDown={canOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(); } } : undefined}
        className={`group w-80 rounded-2xl border-2 text-left transition-all select-none outline-none
          bg-gradient-to-br from-primary/10 via-content1 to-secondary/10
          ${showAsViewResults
            ? "border-success/40 hover:border-success/60"
            : "border-primary/25 hover:border-primary/50"}
          ${canOpen
            ? "cursor-pointer hover:shadow-lg active:scale-[0.98]"
            : "cursor-default opacity-75"}
        `}
        aria-label={`Bài kiểm tra: ${quiz.quiz_title}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-primary/15">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${showAsViewResults ? "bg-success/15" : "bg-primary/15"}`}>
            {showAsViewResults
              ? <CheckBadgeIcon className="w-5 h-5 text-success" />
              : <AcademicCapIcon className="w-5 h-5 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${showAsViewResults ? "text-success" : "text-primary"}`}>
              Bài kiểm tra
            </p>
            <p className="text-sm font-bold truncate text-default-900 leading-tight">
              {quiz.quiz_title}
            </p>
          </div>
          {hasCompleted ? (
            <Chip size="sm" color="success" variant="flat" className="shrink-0 text-[10px] font-semibold">
              Đã hoàn thành
            </Chip>
          ) : isSender ? (
            <Chip size="sm" color="success" variant="flat" className="shrink-0 text-[10px] font-semibold">
              Xem kết quả
            </Chip>
          ) : (
            <Chip size="sm" color={status.color} variant="flat" className="shrink-0 text-[10px] font-semibold">
              {status.label}
            </Chip>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2.5">
          {/* Sắp bắt đầu: đếm ngược */}
          {timeUntilStartLabel && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-warning/10 border border-warning/20">
              <ClockIcon className="w-4 h-4 shrink-0 text-warning" />
              <span className="text-xs font-medium text-warning">
                Sắp bắt đầu sau: <span className="font-bold">{timeUntilStartLabel}</span>
              </span>
            </div>
          )}

          {/* Kết quả nhanh khi đã làm xong */}
          {hasCompleted && (
            <div className="flex items-center justify-between bg-success/8 rounded-lg px-3 py-2 border border-success/15">
              <div className="flex items-center gap-1.5 text-xs text-default-600">
                <span className="font-medium">Điểm của bạn:</span>
                <span className={`font-bold text-sm ${scoreColor}`}>
                  {myScore}/{myMaxScore}
                </span>
                <span className="text-default-400">
                  ({myResult?.correct_count ?? 0}/{totalQuestions} đúng)
                </span>
              </div>
              <span className={`text-xs font-bold ${scoreColor}`}>{myPct}%</span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="font-medium text-default-500 w-16 shrink-0">Bắt đầu:</span>
              <span className="text-default-700 font-medium truncate">
                {formatDateTime(quiz.quiz_startTime)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ClockIcon className="w-3.5 h-3.5 shrink-0 text-danger" />
              <span className="font-medium text-default-500 w-16 shrink-0">Kết thúc:</span>
              <span className="text-default-700 font-medium truncate">
                {formatDateTime(quiz.quiz_endTime)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-0.5">
            <span className="inline-flex items-center gap-1 text-xs bg-default-100 px-2 py-1 rounded-full">
              <span className="font-bold text-default-700">{totalQuestions}</span>
              <span className="text-default-500">câu hỏi</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 px-2 py-1 rounded-full">
              <span className="font-bold text-primary">{totalPoints}</span>
              <span className="text-primary/70">điểm</span>
            </span>
            {quiz.quiz_allowRetake && (
              <span className="text-xs text-default-400">
                Làm lại {quiz.quiz_maxAttempts ? `(${quiz.quiz_maxAttempts} lần)` : "tự do"}
              </span>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        {canOpen && (
          <div
            className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-b-2xl border-t transition-colors
            ${showAsViewResults
              ? "border-success/15 bg-success/5 group-hover:bg-success/10"
              : "border-primary/15 bg-primary/5 group-hover:bg-primary/10"}`}
          >
            {senderCanEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 transition-colors outline-none"
                  aria-label="Sửa quiz"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  Sửa
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-success outline-none hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                >
                  Xem kết quả
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className={`text-xs font-semibold ${showAsViewResults ? "text-success" : "text-primary"}`}>
                  {showAsViewResults ? "Xem kết quả" : "Làm bài ngay"}
                </span>
                <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${showAsViewResults ? "text-success" : "text-primary"}`} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Người gửi: xem kết quả = QuizResultsModal (giống quizz-list). Người làm bài: TakeQuizzModal */}
      {isSender && (
        <QuizResultsModal
          isOpen={openResultsModal}
          onClose={() => setOpenResultsModal(false)}
          quiz={quiz}
        />
      )}

      <TakeQuizzModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        quiz={quiz}
        userId={currentUser?._id ?? ""}
        userFullname={currentUser?.fullname ?? ""}
        userAvatar={currentUser?.avatar}
        hasCompleted={showAsViewResults}
      />

      {isSender && roomId && quiz.quiz_id && (
        <EditQuizzModal
          isOpen={openEditModal}
          onClose={() => setOpenEditModal(false)}
          quiz={quiz}
          roomId={roomId}
          onSuccess={() => setOpenEditModal(false)}
        />
      )}
    </>
  );
}
