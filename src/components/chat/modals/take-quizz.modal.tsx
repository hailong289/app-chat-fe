"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Textarea,
  Avatar,
  Chip,
  Divider,
  Card,
  CardBody,
} from "@heroui/react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  TrophyIcon,
  ClockIcon,
  AcademicCapIcon,
  ChartBarIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import {
  TakeQuizzModalProps,
  QuizzUserAnswer,
  QuizzScoreEntry,
  QuizzQuestion,
  QuizResultResponse,
  LeaderboardEntry,
} from "@/types/quizz.type";
import QuizzService from "@/service/quizz.service";
import useToast from "@/hooks/useToast";
import { useSocket } from "@/components/providers/SocketProvider";
import { socketEvent } from "@/types/socketEvent.type";
import useMessageStore from "@/store/useMessageStore";
import useRoomStore from "@/store/useRoomStore";

type Phase = "intro" | "taking" | "result";

const LEADERBOARD_KEY_PREFIX = "quiz_leaderboard_";
const ATTEMPT_KEY_PREFIX = "quiz_attempts_";

function getAttemptCount(quizId: string, userId: string): number {
  try {
    const raw = localStorage.getItem(`${ATTEMPT_KEY_PREFIX}${quizId}_${userId}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function incrementAttemptCount(quizId: string, userId: string): number {
  const next = getAttemptCount(quizId, userId) + 1;
  try {
    localStorage.setItem(`${ATTEMPT_KEY_PREFIX}${quizId}_${userId}`, String(next));
  } catch {}
  return next;
}

function getLeaderboard(quizId: string): QuizzScoreEntry[] {
  try {
    const raw = localStorage.getItem(`${LEADERBOARD_KEY_PREFIX}${quizId}`);
    if (!raw) return [];
    return JSON.parse(raw) as QuizzScoreEntry[];
  } catch {
    return [];
  }
}

function saveToLeaderboard(quizId: string, entry: QuizzScoreEntry) {
  const existing = getLeaderboard(quizId);
  const updated = [entry, ...existing]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Ít thời gian hơn → xếp trên
      if (a.timeTaken !== undefined && b.timeTaken !== undefined)
        return a.timeTaken - b.timeTaken;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    })
    .slice(0, 20);
  localStorage.setItem(`${LEADERBOARD_KEY_PREFIX}${quizId}`, JSON.stringify(updated));
  return updated;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return "Không giới hạn";
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (diffMs <= 0) return "Không giới hạn";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  return parts.length > 0 ? parts.join(" ") : "< 1 phút";
}

function getMedalColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-amber-600";
  return "text-gray-400";
}

function getRankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

/** Map leaderboard từ backend → QuizzScoreEntry để hiển thị (đã được sort theo rank) */
function mapLeaderboard(leaderboard: LeaderboardEntry[]): QuizzScoreEntry[] {
  return leaderboard.map((entry) => {
    const percentage =
      entry.max_score > 0
        ? Math.round((entry.total_score / entry.max_score) * 100)
        : 0;
    return {
      userId: entry.user_id,
      fullname: entry.user_name,
      avatar: entry.user_avatar,
      score: entry.total_score,
      totalScore: entry.max_score,
      percentage,
      correctCount: entry.correct_count,
      totalQuestions: 0, // không có trong leaderboard entry
      completedAt: new Date().toISOString(),
      timeTaken: entry.time_taken,
    } satisfies QuizzScoreEntry;
  });
}

export const TakeQuizzModal = ({
  isOpen,
  onClose,
  quiz,
  userId,
  userFullname,
  userAvatar,
  hasCompleted,
}: TakeQuizzModalProps) => {
  const toast = useToast();
  const { socket } = useSocket("/chat");
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<QuizzUserAnswer[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitReady, setSubmitReady] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState<QuizzScoreEntry[]>([]);
  const [myEntry, setMyEntry] = useState<QuizzScoreEntry | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverAnswers, setServerAnswers] = useState<import("@/types/quizz.type").UserAnswerPayload[]>([]);
  const startedAtRef = useRef<string>(new Date().toISOString());

  const questions = quiz.quiz_questions;
  const totalQuestions = questions.length;
  const totalScore = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points || 0), 0),
    [questions]
  );

  // _id là ObjectId từ MongoDB, quiz_id là alias — ưu tiên _id
  const resolvedQuizId = quiz._id ?? quiz.quiz_id ?? quiz.quiz_title;

  // Reset state khi modal mở/đóng
  useEffect(() => {
    if (!isOpen) return;

    setCurrentIndex(0);
    setUserAnswers([]);
    setServerAnswers([]);
    setElapsed(0);
    setCountdown(null);
    setSubmitReady(false);
    setShowExplanation(false);
    setMyEntry(null);
    setFinalLeaderboard([]);
    setAttemptCount(getAttemptCount(resolvedQuizId, userId));

    if (hasCompleted && resolvedQuizId) {
      // Mở thẳng phase result và fetch leaderboard + kết quả của user
      setPhase("result");
      setIsSubmitting(true);
      QuizzService.getResults(resolvedQuizId)
        .then((res) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta = (res as any)?.data?.metadata;
          const lb: LeaderboardEntry[] = meta?.leaderboard ?? [];
          if (lb.length > 0) setFinalLeaderboard(mapLeaderboard(lb));

          // my_result: server trả về kết quả riêng của user hiện tại (kể cả user_answers)
          const myResult = meta?.my_result;
          if (myResult?.user_answers?.length) {
            setServerAnswers(myResult.user_answers);
          }

          const percentage =
            myResult && myResult.max_score > 0
              ? Math.round((myResult.total_score / myResult.max_score) * 100)
              : 0;

          setMyEntry({
            userId,
            fullname: userFullname,
            avatar: userAvatar,
            score: myResult?.total_score ?? 0,
            totalScore: myResult?.max_score ?? totalScore,
            percentage,
            correctCount: myResult?.correct_count ?? 0,
            totalQuestions: myResult?.total_questions ?? totalQuestions,
            completedAt: myResult?.completed_at ?? new Date().toISOString(),
            timeTaken: myResult?.time_taken,
          });
        })
        .catch((error) => {
          console.error("🚀 ~ error:", error);
          // Fallback: set entry rỗng để thoát skeleton
          setMyEntry({
            userId,
            fullname: userFullname,
            avatar: userAvatar,
            score: 0,
            totalScore,
            percentage: 0,
            correctCount: 0,
            totalQuestions,
            completedAt: new Date().toISOString(),
          });
        })
        .finally(() => setIsSubmitting(false));
    } else {
      setPhase("intro");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Elapsed timer (luôn chạy khi đang làm bài)
  useEffect(() => {
    if (phase !== "taking") return;
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Countdown từ quiz_endTime
  useEffect(() => {
    if (phase !== "taking" || !quiz.quiz_endTime) return;

    const calcRemaining = () =>
      Math.max(0, Math.floor((new Date(quiz.quiz_endTime!).getTime() - Date.now()) / 1000));

    setCountdown(calcRemaining());

    const interval = setInterval(() => {
      const rem = calcRemaining();
      setCountdown(rem);
      if (rem <= 0) {
        clearInterval(interval);
        // Auto-submit khi hết giờ (dùng timeout nhỏ để state answers cập nhật xong)
        setTimeout(() => handleSubmit(), 100);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quiz.quiz_endTime]);

  const currentQuestion: QuizzQuestion | undefined = questions[currentIndex];

  const getCurrentAnswer = useCallback((): QuizzUserAnswer => {
    return (
      userAnswers.find((a) => a.questionIndex === currentIndex) ?? {
        questionIndex: currentIndex,
        selectedAnswers: [],
        textAnswer: "",
      }
    );
  }, [userAnswers, currentIndex]);

  const updateAnswer = useCallback((answer: QuizzUserAnswer) => {
    setUserAnswers((prev) => {
      const filtered = prev.filter((a) => a.questionIndex !== answer.questionIndex);
      return [...filtered, answer];
    });
  }, []);

  const handleSingleChoice = (answerIdx: number) => {
    updateAnswer({
      questionIndex: currentIndex,
      selectedAnswers: [answerIdx],
    });
  };

  const handleMultipleChoice = (answerIdx: number, checked: boolean) => {
    const cur = getCurrentAnswer();
    const selected = checked
      ? [...cur.selectedAnswers, answerIdx]
      : cur.selectedAnswers.filter((i) => i !== answerIdx);
    updateAnswer({ questionIndex: currentIndex, selectedAnswers: selected });
  };

  const handleTextAnswer = (text: string) => {
    updateAnswer({
      questionIndex: currentIndex,
      selectedAnswers: [],
      textAnswer: text,
    });
  };

  // Tính điểm
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // Chuyển sang phase result ngay; myEntry=null → hiển thị skeleton chờ server
    setPhase("result");

    const completedAt = new Date().toISOString();
    const timeTaken = elapsed;
    const quizId = resolvedQuizId;

    setAttemptCount((prev) => prev + 1);

    // Build user_answers payload — backend sẽ tính is_correct & points_earned
    const answeredAt = new Date().toISOString();
    const userAnswersPayload = questions.map((q, qi) => {
      const answer = userAnswers.find((a) => a.questionIndex === qi);
      return {
        question_index: qi,
        selected_answer_indices: answer?.selectedAnswers ?? [],
        text_answer: answer?.textAnswer ?? "",
        is_correct: false,
        points_earned: 0,
        answered_at: answeredAt,
      };
    });

    /** Áp dụng kết quả từ server vào state */
    const applyServerResult = (r: QuizResultResponse) => {
      const maxScore = r.max_score ?? totalScore;
      const percentage = maxScore > 0 ? Math.round((r.total_score / maxScore) * 100) : 0;
      const entry: QuizzScoreEntry = {
        userId,
        fullname: userFullname,
        avatar: userAvatar,
        score: r.total_score,
        totalScore: maxScore,
        percentage,
        correctCount: r.correct_count,
        totalQuestions: r.total_questions ?? totalQuestions,
        completedAt: r.completed_at ?? completedAt,
        timeTaken: r.time_taken ?? timeTaken,
      };
      setMyEntry(entry);
      if (r.user_answers?.length) {
        setServerAnswers(r.user_answers);
      }
    };

    if (!quizId) {
      toast.error("Không tìm thấy thông tin bài quiz.");
      setPhase("taking");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Nộp bài — backend tính điểm, lấy kết quả ngay từ response
      const submitRes = await QuizzService.submitResult(quizId, {
        user_answers: userAnswersPayload,
        total_score: 0,
        max_score: totalScore,
        correct_count: 0,
        total_questions: totalQuestions,
        started_at: startedAtRef.current,
        completed_at: completedAt,
        time_taken: timeTaken,
        is_completed: true,
        is_submitted: true,
      });

      const submitResult = submitRes.data?.metadata;
      if (submitResult) {
        applyServerResult(submitResult);
        const payload = submitResult.quiz;
        const roomId = quiz.quiz_roomId;
        if (socket && roomId) {
          const roomStore = useRoomStore.getState();
          const room = roomStore.rooms.find((r) => r._id === roomId || r.roomId === roomId);
          await useMessageStore.getState().updateQuizInMessages(room?.roomId ?? roomId, String(quizId), payload ?? {});
          socket?.emit(socketEvent.UPDATE_QUIZ, {
            roomId: room?.roomId ?? roomId,
            quizId: String(quizId),
            payload: payload,
          });
        }
      }

      // 2. Lấy toàn bộ kết quả & leaderboard ngay sau khi nộp thành công
      const leaderRes = await QuizzService.getResults(quizId);
      const resultsMeta = leaderRes.data?.metadata;

      const lb: LeaderboardEntry[] = resultsMeta?.leaderboard ?? [];
      if (lb.length > 0) {
        setFinalLeaderboard(mapLeaderboard(lb));
      }

      // Ưu tiên my_result từ server (có user_answers đầy đủ)
      if (resultsMeta?.my_result) {
        applyServerResult(resultsMeta.my_result);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message ?? "Nộp bài thất bại. Vui lòng thử lại.");
      setPhase("taking");
    }

    setIsSubmitting(false);
  }, [
    isSubmitting,
    totalScore,
    elapsed,
    userId,
    userFullname,
    userAvatar,
    totalQuestions,
    quiz,
    questions,
    userAnswers,
    resolvedQuizId,
    toast,
    socket,
  ]);

  const isAnswered = (qi: number): boolean => {
    const answer = userAnswers.find((a) => a.questionIndex === qi);
    if (!answer) return false;
    if (questions[qi]?.question_type === "text") return !!answer.textAnswer?.trim();
    return answer.selectedAnswers.length > 0;
  };

  const answeredCount = questions.filter((_, qi) => isAnswered(qi)).length;

  const isQuestionCorrect = useCallback(
    (qi: number): boolean | null => {
      const q = questions[qi];
      if (!q || q.question_type === "text") return null;
      const serverAnswer = serverAnswers.find((a) => a.question_index === qi);
      if (!serverAnswer) return false;
      return serverAnswer.is_correct;
    },
    [questions, serverAnswers]
  );

  const progressValue = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // ─────────────────────────────── RENDER ───────────────────────────────

  const renderIntro = () => (
    <div className="flex flex-col items-center justify-center h-full py-8 gap-6 text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
        <AcademicCapIcon className="w-10 h-10 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold">{quiz.quiz_title}</h2>
        {quiz.quiz_description && (
          <p className="text-default-500 text-sm">{quiz.quiz_description}</p>
        )}
      </div>
      <div className="flex gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-bold text-primary">{totalQuestions}</span>
          <span className="text-xs text-default-500">Câu hỏi</span>
        </div>
        <Divider orientation="vertical" className="h-12" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-bold text-primary">{totalScore}</span>
          <span className="text-xs text-default-500">Tổng điểm</span>
        </div>
        <Divider orientation="vertical" className="h-12" />
        <div className="flex flex-col items-center gap-1">
          <ClockIcon className="w-6 h-6 text-default-400 mx-auto" />
          <span className="text-xs font-semibold text-default-700">
            {formatDuration(quiz.quiz_startTime, quiz.quiz_endTime)}
          </span>
          <span className="text-xs text-default-500">Thời lượng</span>
        </div>
      </div>
      <Button
        color="primary"
        size="lg"
        className="px-10 font-semibold"
        onPress={() => {
          startedAtRef.current = new Date().toISOString();
          setPhase("taking");
        }}
      >
        Bắt đầu làm bài
      </Button>
    </div>
  );

  const renderTaking = () => {
    if (!currentQuestion) return null;
    const curAnswer = getCurrentAnswer();

    return (
      <div className="flex flex-col h-full gap-4">
        {/* Header info */}
        <div className="flex items-center justify-between text-sm text-default-500">
          <span className="font-medium">
            Câu {currentIndex + 1} / {totalQuestions}
          </span>
          <div className={`flex items-center gap-1.5 font-mono font-semibold ${
            countdown !== null
              ? countdown <= 60
                ? "text-danger animate-pulse"
                : countdown <= 300
                ? "text-warning"
                : "text-default-500"
              : "text-default-500"
          }`}>
            <ClockIcon className="w-4 h-4" />
            <span>
              {countdown !== null ? formatCountdown(countdown) : formatTime(elapsed)}
            </span>
          </div>
          <span className="font-medium">
            {answeredCount}/{totalQuestions} đã trả lời
          </span>
        </div>

        {/* Progress */}
        <Progress
          value={progressValue}
          color="primary"
          size="sm"
          className="w-full"
          aria-label="Tiến độ làm bài"
        />

        {/* Question dots */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {questions.map((_, qi) => (
            <button
              key={qi}
              onClick={() => setCurrentIndex(qi)}
              className={`w-7 h-7 rounded-full text-xs font-semibold transition-all border-2 ${
                qi === currentIndex
                  ? "bg-primary text-white border-primary scale-110"
                  : isAnswered(qi)
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-default-100 text-default-500 border-default-200 hover:border-primary/50"
              }`}
              aria-label={`Câu ${qi + 1}`}
            >
              {qi + 1}
            </button>
          ))}
        </div>

        <Divider />

        {/* Question card */}
        <Card className="flex-1 overflow-auto border border-default-200">
          <CardBody className="gap-5 p-5">
            <div className="flex items-start gap-3">
              <Chip
                size="sm"
                color="primary"
                variant="flat"
                className="shrink-0 mt-0.5"
              >
                {currentIndex + 1}
              </Chip>
              <div className="flex-1">
                <p className="font-semibold text-base leading-relaxed">
                  {currentQuestion.question_text}
                </p>
                <div className="flex gap-2 mt-1.5">
                  <Chip size="sm" variant="flat" color="secondary">
                    {currentQuestion.points} điểm
                  </Chip>
                  <Chip size="sm" variant="flat" color="default">
                    {currentQuestion.question_type === "single_choice"
                      ? "Một lựa chọn"
                      : currentQuestion.question_type === "multiple_choice"
                      ? "Nhiều lựa chọn"
                      : currentQuestion.question_type === "true_false"
                      ? "Đúng / Sai"
                      : "Tự luận"}
                  </Chip>
                </div>
              </div>
            </div>

            {/* Answer options */}
            <div className="space-y-2.5">
              {(currentQuestion.question_type === "single_choice" ||
                currentQuestion.question_type === "true_false") &&
                currentQuestion.answers.map((answer, ai) => {
                  const selected = curAnswer.selectedAnswers.includes(ai);
                  const optionLabel = String.fromCharCode(65 + ai); // A, B, C, D...
                  return (
                    <button
                      key={ai}
                      type="button"
                      onClick={() => handleSingleChoice(ai)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-default-200 bg-default-50 hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          selected
                            ? "bg-primary border-primary text-white"
                            : "border-default-300 text-default-500"
                        }`}
                      >
                        {optionLabel}
                      </span>
                      <span className="text-sm font-medium flex-1">
                        {answer.answer_text}
                      </span>
                      {selected && (
                        <CheckCircleSolid className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}

              {currentQuestion.question_type === "multiple_choice" &&
                currentQuestion.answers.map((answer, ai) => {
                  const checked = curAnswer.selectedAnswers.includes(ai);
                  const optionLabel = String.fromCharCode(65 + ai);
                  return (
                    <button
                      key={ai}
                      type="button"
                      onClick={() => handleMultipleChoice(ai, !checked)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-default-200 bg-default-50 hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          checked
                            ? "bg-primary border-primary text-white"
                            : "border-default-300 text-default-500"
                        }`}
                      >
                        {optionLabel}
                      </span>
                      <span className="text-sm font-medium flex-1">
                        {answer.answer_text}
                      </span>
                      {checked && (
                        <CheckCircleSolid className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}

              {currentQuestion.question_type === "text" && (
                <Textarea
                  placeholder="Nhập câu trả lời của bạn..."
                  value={curAnswer.textAnswer ?? ""}
                  onChange={(e) => handleTextAnswer(e.target.value)}
                  minRows={3}
                  maxRows={6}
                  variant="bordered"
                  classNames={{
                    input: "text-sm",
                    inputWrapper: "border-2",
                  }}
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };

  const renderResult = () => {
    // Skeleton chỉ hiện khi đang chờ API (isSubmitting), không phải khi myEntry null mãi
    if (isSubmitting || !myEntry) {
      return (
        <div className="flex flex-col items-center justify-center gap-5 py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 animate-pulse" />
          <div className="space-y-2 text-center">
            <div className="h-4 w-36 bg-default-200 rounded animate-pulse mx-auto" />
            <div className="h-3 w-24 bg-default-100 rounded animate-pulse mx-auto" />
          </div>
          <p className="text-sm text-default-400">Đang lấy kết quả...</p>
        </div>
      );
    }

    const myRank =
      finalLeaderboard.findIndex(
        (e) => e.userId === userId && e.completedAt === myEntry.completedAt
      ) + 1;

    const scoreColor =
      myEntry.percentage >= 80
        ? "text-success"
        : myEntry.percentage >= 50
        ? "text-warning"
        : "text-danger";

    return (
      <div className="flex flex-col gap-6 pb-2">
        {/* Score card */}
        <div className="flex flex-col items-center gap-3 py-4 bg-gradient-to-b from-primary/10 to-transparent rounded-xl">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center bg-white dark:bg-content1 shadow-lg">
              <span className={`text-3xl font-bold ${scoreColor}`}>
                {myEntry.percentage}%
              </span>
            </div>
            {myEntry.percentage === 100 && (
              <span className="absolute -top-2 -right-2 text-2xl">🎉</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">
              {myEntry.score} / {myEntry.totalScore} điểm
            </p>
            <p className="text-sm text-default-500">
              {myEntry.correctCount} câu đúng / {myEntry.totalQuestions} câu hỏi
            </p>
            {quiz.quiz_questions.some((q) => q.question_type === "text") && (
              <p className="text-xs text-warning-500 mt-1">
                * Câu tự luận chưa được chấm điểm tự động
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-default-500">
            <ClockIcon className="w-4 h-4" />
            <span>Thời gian: {formatTime(elapsed)}</span>
            {myRank > 0 && (
              <>
                <span>•</span>
                <TrophyIcon className={`w-4 h-4 ${getMedalColor(myRank)}`} />
                <span>Xếp hạng {myRank}</span>
              </>
            )}
          </div>
        </div>

        {/* Question review */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-1.5">
              <ChartBarIcon className="w-5 h-5 text-primary" />
              Chi tiết câu trả lời
            </h3>
            <Button
              size="sm"
              variant="light"
              onPress={() => setShowExplanation((p) => !p)}
            >
              {showExplanation ? "Ẩn giải thích" : "Xem giải thích"}
            </Button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {questions.map((q, qi) => {
              const isCorrect = isQuestionCorrect(qi);
              const answer = userAnswers.find((a) => a.questionIndex === qi);
              return (
                <div
                  key={qi}
                  className={`rounded-lg border p-3 text-sm ${
                    isCorrect === null
                      ? "border-default-200 bg-default-50"
                      : isCorrect
                      ? "border-success-200 bg-success-50"
                      : "border-danger-200 bg-danger-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect === null ? (
                      <span className="text-default-400 mt-0.5">✍️</span>
                    ) : isCorrect ? (
                      <CheckCircleSolid className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-2">
                        {qi + 1}. {q.question_text}
                      </p>
                      {q.question_type !== "text" && (
                        <div className="mt-1.5 space-y-1">
                          {!isCorrect && (
                            <p className="text-xs text-default-500">
                              <span className="font-medium">Đáp án đúng:</span>{" "}
                              {q.answers
                                .filter((a) => a.is_correct)
                                .map((a) => a.answer_text)
                                .join(", ")}
                            </p>
                          )}
                          {answer && answer.selectedAnswers.length > 0 && !isCorrect && (
                            <p className="text-xs text-danger-600">
                              <span className="font-medium">Bạn chọn:</span>{" "}
                              {answer.selectedAnswers
                                .map((i) => q.answers[i]?.answer_text)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                      {q.question_type === "text" && answer?.textAnswer && (
                        <p className="text-xs text-default-500 mt-1 line-clamp-2">
                          Câu trả lời: {answer.textAnswer}
                        </p>
                      )}
                      {showExplanation && q.explanation && (
                        <p className="text-xs text-primary-600 mt-1 italic">
                          💡 {q.explanation}
                        </p>
                      )}
                    </div>
                    <Chip size="sm" variant="flat" color="default" className="shrink-0">
                      {q.points}đ
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h3 className="font-semibold flex items-center gap-1.5 mb-3">
            <TrophyIcon className="w-5 h-5 text-yellow-500" />
            Bảng xếp hạng
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {finalLeaderboard.length === 0 ? (
              <p className="text-center text-default-400 text-sm py-3">
                Chưa có dữ liệu
              </p>
            ) : (
              finalLeaderboard.map((entry, idx) => {
                const rank = idx + 1;
                const isMe =
                  entry.userId === userId &&
                  myEntry &&
                  entry.completedAt === myEntry.completedAt;
                return (
                  <div
                    key={`${entry.userId}-${entry.completedAt}`}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors ${
                      isMe
                        ? "border-primary bg-primary/10"
                        : "border-default-200 bg-default-50"
                    }`}
                  >
                    <span
                      className={`text-lg w-8 text-center font-bold shrink-0 ${getMedalColor(rank)}`}
                    >
                      {getRankLabel(rank)}
                    </span>
                    <Avatar
                      src={entry.avatar}
                      name={entry.fullname}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {entry.fullname}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal text-primary">
                            (Bạn)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-default-400">
                        {entry.correctCount}/{entry.totalQuestions} đúng
                        {entry.timeTaken !== undefined && (
                          <> • {formatTime(entry.timeTaken)}</>
                        )}
                        {" • "}
                        {new Date(entry.completedAt).toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">
                        {entry.score}đ
                      </p>
                      <p className="text-xs text-default-400">{entry.percentage}%</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="2xl"
      scrollBehavior="inside"
      placement="center"
      classNames={{
        base: "max-h-[92vh]",
        body: "p-5 gap-0",
        header: "pb-3",
        footer: "pt-3",
      }}
    >
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <AcademicCapIcon className="w-5 h-5 text-primary" />
                  <span className="text-base font-semibold">
                    {phase === "intro"
                      ? "Thông tin bài kiểm tra"
                      : phase === "taking"
                      ? quiz.quiz_title
                      : "Kết quả"}
                  </span>
                </div>
                {phase === "taking" && (
                  countdown !== null ? (
                    <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${
                      countdown <= 60
                        ? "text-danger animate-pulse"
                        : countdown <= 300
                        ? "text-warning"
                        : "text-default-500"
                    }`}>
                      <ClockIcon className="w-4 h-4" />
                      <span>{formatCountdown(countdown)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm text-default-500">
                      <ClockIcon className="w-4 h-4" />
                      <span className="font-mono font-medium">{formatTime(elapsed)}</span>
                    </div>
                  )
                )}
              </div>
            </ModalHeader>

            <ModalBody>
              {phase === "intro" && renderIntro()}
              {phase === "taking" && renderTaking()}
              {phase === "result" && renderResult()}
            </ModalBody>

            <ModalFooter>
              {phase === "intro" && (
                <Button variant="light" color="danger" onPress={onModalClose}>
                  Hủy
                </Button>
              )}

              {phase === "taking" && (
                <div className="flex items-center justify-between w-full gap-2">
                  {/* Câu trước */}
                  <Button
                    variant="flat"
                    isDisabled={currentIndex === 0}
                    onPress={() => setCurrentIndex((p) => p - 1)}
                  >
                    ← Câu trước
                  </Button>

                  <div className="flex items-center gap-2">
                    {/* Nút cờ — bật/tắt chế độ nộp bài */}
                    {!submitReady ? (
                      <Button
                        variant="flat"
                        color="warning"
                        size="sm"
                        startContent={<FlagIcon className="w-4 h-4" />}
                        onPress={() => setSubmitReady(true)}
                      >
                        Nộp bài
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="flat"
                          size="sm"
                          onPress={() => setSubmitReady(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          color="success"
                          size="sm"
                          className="font-semibold text-white"
                          onPress={handleSubmit}
                          startContent={<CheckCircleIcon className="w-4 h-4" />}
                        >
                          Xác nhận nộp ({answeredCount}/{totalQuestions})
                        </Button>
                      </>
                    )}

                    {/* Câu tiếp — ẩn khi đã giơ cờ */}
                    {!submitReady && currentIndex < totalQuestions - 1 && (
                      <Button
                        color="primary"
                        onPress={() => setCurrentIndex((p) => p + 1)}
                      >
                        Câu tiếp →
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {phase === "result" && (() => {
                const allowRetake = quiz.quiz_allowRetake === true;
                const maxAttempts = quiz.quiz_maxAttempts ?? null;
                const canRetake = allowRetake && (maxAttempts === null || attemptCount < maxAttempts);
                const remainingAttempts = maxAttempts !== null ? Math.max(0, maxAttempts - attemptCount) : null;

                return (
                  <div className="flex items-center justify-between w-full gap-2">
                    {/* Thông tin lần làm */}
                    {allowRetake && (
                      <span className="text-xs text-default-400">
                        Đã làm: <span className="font-semibold text-default-600">{attemptCount}</span> lần
                        {maxAttempts !== null && (
                          <> / {maxAttempts} · Còn lại:{" "}
                            <span className={remainingAttempts === 0 ? "text-danger font-semibold" : "font-semibold text-default-600"}>
                              {remainingAttempts}
                            </span>
                          </>
                        )}
                      </span>
                    )}

                    <div className="flex gap-2 ml-auto">
                      {canRetake && (
                        <Button
                          variant="flat"
                          startContent={<FlagIcon className="w-4 h-4" />}
                          onPress={() => {
                            setPhase("intro");
                            setCurrentIndex(0);
                            setUserAnswers([]);
                            setElapsed(0);
                            setCountdown(null);
                            setSubmitReady(false);
                            setMyEntry(null);
                          }}
                        >
                          Làm lại
                          {remainingAttempts !== null && (
                            <span className="ml-1 text-xs opacity-70">({remainingAttempts} lần)</span>
                          )}
                        </Button>
                      )}
                      <Button color="primary" onPress={onModalClose}>
                        Đóng
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
