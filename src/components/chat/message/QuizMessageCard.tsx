"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { TakeQuizzModal } from "@/components/chat/modals/take-quizz.modal";
import { QuizzResponse, QuizResultResponse } from "@/types/quizz.type";
import { User } from "@/types/auth.type";

interface QuizMessageCardProps {
  quiz: QuizzResponse;
  currentUser: User | null;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "Không giới hạn";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Không xác định";
  }
}

function getQuizStatus(quiz: QuizzResponse): {
  label: string;
  color: "success" | "warning" | "danger" | "default";
} {
  const now = new Date();
  if (quiz.quiz_startTime && new Date(quiz.quiz_startTime) > now) {
    return { label: "Chưa bắt đầu", color: "warning" };
  }
  if (quiz.quiz_endTime && new Date(quiz.quiz_endTime) < now) {
    return { label: "Đã kết thúc", color: "danger" };
  }
  if (quiz.quiz_status === "active") {
    return { label: "Đang mở", color: "success" };
  }
  return { label: "Bản nháp", color: "default" };
}

export function QuizMessageCard({ quiz, currentUser }: QuizMessageCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const quizId = quiz._id ?? quiz.quiz_id;
  const totalQuestions = quiz.quiz_questions?.length ?? 0;
  const totalPoints =
    quiz.quiz_questions?.reduce((s, q) => s + (q.points ?? 0), 0) ?? 0;
  const status = getQuizStatus(quiz);
  const isEnded = status.color === "danger";

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

  // Cho phép click: chưa kết thúc, hoặc đã làm (để xem lại kết quả)
  const canOpen = (!isEnded || hasCompleted) && !!quizId;

  const handleOpen = () => {
    if (canOpen) setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`group w-80 rounded-2xl border-2 text-left transition-all select-none outline-none
          bg-gradient-to-br from-primary/10 via-content1 to-secondary/10
          ${hasCompleted
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasCompleted ? "bg-success/15" : "bg-primary/15"}`}>
            {hasCompleted
              ? <CheckBadgeIcon className="w-5 h-5 text-success" />
              : <AcademicCapIcon className="w-5 h-5 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${hasCompleted ? "text-success" : "text-primary"}`}>
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
          ) : (
            <Chip size="sm" color={status.color} variant="flat" className="shrink-0 text-[10px] font-semibold">
              {status.label}
            </Chip>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2.5">
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
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-b-2xl border-t transition-colors
            ${hasCompleted
              ? "border-success/15 bg-success/5 group-hover:bg-success/10"
              : "border-primary/15 bg-primary/5 group-hover:bg-primary/10"}`}
          >
            <span className={`text-xs font-semibold ${hasCompleted ? "text-success" : "text-primary"}`}>
              {hasCompleted ? "Xem kết quả" : "Làm bài ngay"}
            </span>
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${hasCompleted ? "text-success" : "text-primary"}`} />
          </div>
        )}
      </button>

      {/* Luôn render modal, để HeroUI quản lý animation qua isOpen prop */}
      <TakeQuizzModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        quiz={quiz}
        userId={currentUser?._id ?? ""}
        userFullname={currentUser?.fullname ?? ""}
        userAvatar={currentUser?.avatar}
        hasCompleted={hasCompleted}
      />
    </>
  );
}
