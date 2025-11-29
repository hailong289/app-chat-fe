import React from "react";
import { Avatar, AvatarGroup, Tooltip } from "@heroui/react";
import useAuthStore from "@/store/useAuthStore";
import { User } from "@/store/types/room.state";

// Định nghĩa kiểu dữ liệu User

type TypingIndicatorProps = {
  readonly users: readonly User[]; // Danh sách những ai đang gõ
};

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  const authState = useAuthStore((state) => state);
  users = users.filter(
    (u) =>
      authState.user &&
      u.id !== authState.user.id &&
      u.name &&
      u.name.trim() !== ""
  );
  if (users.length === 0) return null;

  // Extracted message logic from nested ternary
  let typingMessage = "";
  if (users.length > 2) {
    typingMessage = "Nhiều người đang nhập...";
  } else if (users.length === 2) {
    typingMessage = `${users[0].name} & ${users[1].name} đang gõ`;
  }

  return (
    <div className="flex items-end gap-2 p-2 fade-in">
      {/* 1. Hiển thị Avatar người đang gõ */}
      <div className="shrink-0 mb-1">
        {users.length === 1 ? (
          // Solo: 1 người gõ
          <Tooltip content={users[0].name} placement="bottom">
            <Avatar src={users[0].avatar ?? undefined} className="w-3 h-3" />
          </Tooltip>
        ) : (
          // Squad: Nhiều người gõ (Avatar Group)
          <AvatarGroup max={3} className="w-3 h-3">
            {users.map((u) => (
              <Tooltip content={u.name} placement="bottom" key={u.id}>
                <Avatar src={u.avatar ?? undefined} />
              </Tooltip>
            ))}
          </AvatarGroup>
        )}
      </div>

      {/* 2. Cái bong bóng chứa 3 dấu chấm (The Bubble) */}
      <div className="bg-default-100 dark:bg-default-50 rounded-2xl rounded-tl-none px-1 py-1 flex items-center gap-1 w-fit shadow-sm">
        {/* Dấu chấm 1 */}
        <div
          className="w-2 h-2 bg-default-500 rounded-full animate-bounce"
          style={{ animationDuration: "0.6s" }}
        />
        {/* Dấu chấm 2 (Delay xíu) */}
        <div
          className="w-2 h-2 bg-default-500 rounded-full animate-bounce"
          style={{ animationDuration: "0.6s", animationDelay: "0.1s" }}
        />
        {/* Dấu chấm 3 (Delay xíu nữa) */}
        <div
          className="w-2 h-2 bg-default-500 rounded-full animate-bounce"
          style={{ animationDuration: "0.6s", animationDelay: "0.2s" }}
        />
      </div>

      {/* 3. Text thông báo (Optional - cho Group chat đông vui) */}
      <span className="text-tiny text-default-400 mb-2 ml-1">
        {typingMessage}
      </span>
    </div>
  );
}
