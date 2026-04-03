"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Avatar,
  Chip,
  Divider,
} from "@heroui/react";
import { useEffect, useState } from "react";
import {
  TrophyIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import QuizzService from "@/service/quizz.service";
import { QuizzResponse, LeaderboardEntry } from "@/types/quizz.type";

interface QuizResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: QuizzResponse;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getMedalEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function QuizResultsModal({ isOpen, onClose, quiz }: QuizResultsModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const quizId = quiz._id ?? quiz.quiz_id;

  useEffect(() => {
    if (!isOpen || !quizId) return;
    setIsLoading(true);
    QuizzService.getResults(quizId)
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (res as any)?.data ?? res;
        const lb: LeaderboardEntry[] = raw?.leaderboard ?? [];
        setLeaderboard(lb);
        setTotalParticipants(raw?.total_participants ?? 0);
        setTotalSubmissions(raw?.total_submissions ?? 0);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen, quizId]);

  const totalScore = quiz.quiz_questions?.reduce((s, q) => s + (q.points ?? 0), 0) ?? 0;

  const isEnded = quiz.quiz_endTime && new Date(quiz.quiz_endTime) < new Date();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <>
          <ModalHeader className="flex flex-col gap-1">
            <p className="text-base font-bold">{quiz.quiz_title}</p>
            <p className="text-xs font-normal text-default-400">Kết quả & Thành viên tham gia</p>
          </ModalHeader>

          <ModalBody className="gap-4">
            {isLoading ? (
              <div className="flex flex-col gap-3 py-8">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-default-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-primary/8 border border-primary/15">
                    <UserGroupIcon className="w-5 h-5 text-primary" />
                    <span className="text-xl font-bold text-primary">{totalParticipants}</span>
                    <span className="text-[11px] text-default-500">Tham gia</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-success/8 border border-success/15">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <span className="text-xl font-bold text-success">{totalSubmissions}</span>
                    <span className="text-[11px] text-default-500">Đã nộp</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-warning/8 border border-warning/15">
                    <ClockIcon className="w-5 h-5 text-warning" />
                    <span className="text-xl font-bold text-warning">
                      {totalParticipants - totalSubmissions}
                    </span>
                    <span className="text-[11px] text-default-500">Chưa nộp</span>
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    color={isEnded ? "danger" : "success"}
                    variant="flat"
                    className="text-[11px]"
                  >
                    {isEnded ? "Đã kết thúc" : "Đang diễn ra"}
                  </Chip>
                  <span className="text-xs text-default-400">
                    Tổng điểm tối đa: <strong>{totalScore}đ</strong>
                  </span>
                </div>

                <Divider />

                {/* Leaderboard */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrophyIcon className="w-4 h-4 text-yellow-500" />
                    <h3 className="text-sm font-semibold">Bảng xếp hạng</h3>
                  </div>

                  {leaderboard.length === 0 ? (
                    <p className="text-sm text-default-400 text-center py-4">
                      Chưa có ai nộp bài
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.map((entry) => {
                        const pct =
                          entry.max_score > 0
                            ? Math.round((entry.total_score / entry.max_score) * 100)
                            : 0;
                        const scoreColor =
                          pct >= 80
                            ? "text-success"
                            : pct >= 50
                            ? "text-warning"
                            : "text-danger";

                        return (
                          <div
                            key={entry.user_id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                              ${entry.rank <= 3
                                ? "bg-gradient-to-r from-yellow-50/50 to-transparent border-yellow-200/50 dark:from-yellow-900/10 dark:border-yellow-700/30"
                                : "bg-default-50 border-default-100"}`}
                          >
                            <span className="text-lg w-8 text-center shrink-0">
                              {getMedalEmoji(entry.rank)}
                            </span>
                            <Avatar
                              src={entry.user_avatar}
                              name={entry.user_name}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{entry.user_name}</p>
                              <p className="text-xs text-default-400">
                                {entry.correct_count}/{quiz.quiz_questions?.length ?? 0} đúng
                                {" • "}⏱ {formatTime(entry.time_taken)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${scoreColor}`}>
                                {entry.total_score}/{entry.max_score}đ
                              </p>
                              <p className={`text-xs ${scoreColor}`}>{pct}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </>
            )}
          </ModalBody>

          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Đóng
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}
