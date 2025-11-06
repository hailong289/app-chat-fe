import { create, useStore } from "zustand";
import {
  MessageSender,
  MessageState,
  MessageType,
  msg,
} from "./types/message.state";

export interface SendMessageArgs {
  roomId: string;
  content: string;
  attachments: File[];
  type: "text" | "image" | "file" | "video";
  replyTo?: string;
  socket?: any; // Socket instance
  userId?: string; // User ID
  userFullname?: string; // User fullname
  userAvatar?: string; // User avatar
}
import { createJSONStorage, persist } from "zustand/middleware";
import { upsertOne } from "@/libs/crud";
import { db } from "@/libs/db";
import { ObjectId } from "bson";
// const { socket, status } = useSocket();
const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      messagesRoom: {},
      upsetMsg: async (msgData: MessageType) => {
        console.log("🚀 ~ msgData:", msgData);
        if (!msgData.roomId) return;
        let lastMsgId: string | null = msgData.id ?? null;

        await upsertOne(db.messages, msgData);
        const prevRoom = get().messagesRoom[msgData.roomId] || {};
        const prevMessages = prevRoom.messages || [];
        // Tìm vị trí message theo id
        const idx = prevMessages.findIndex((m) => m.id === msgData.id);
        let newMessages;
        if (idx !== -1) {
          // Nếu đã có thì cập nhật lại
          newMessages = [
            ...prevMessages.slice(0, idx),
            msgData,
            ...prevMessages.slice(idx + 1),
          ];
        } else {
          // Nếu chưa có thì thêm mới
          newMessages = [...prevMessages, msgData];
        }
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [msgData.roomId]: {
              ...prevRoom,
              messages: newMessages,
              ...(msgData.isRead && { last_message_id: lastMsgId }),
            },
          },
        });
      },

      sendMessage: async (args: SendMessageArgs) => {
        const {
          roomId,
          content,
          attachments,
          type,
          replyTo,
          socket,
          userId,
          userFullname,
          userAvatar,
        } = args;

        // Lưu dữ liệu tạm trước khi gửi
        const prevRoom = get().messagesRoom[roomId] || {};

        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...prevRoom,
              input: content,
              attachments: attachments, // Lưu trực tiếp File[]
              ghim: prevRoom.ghim || [],
              updatedAt: new Date().toISOString(),
              messages: prevRoom.messages || [],
            },
          },
        });

        const id = new ObjectId().toHexString();
        const foundReply = get().messagesRoom[roomId]?.messages.find(
          (m) => m.id === replyTo
        );
        const reply = foundReply
          ? {
              _id: foundReply.id,
              type: foundReply.type,
              content: foundReply.content,
              createdAt: foundReply.createdAt,
              sender: {
                _id: foundReply.sender._id,
                name: foundReply.sender.fullname || "Unknown",
              },
            }
          : undefined;
        const data: MessageType = {
          id,
          roomId,
          content,
          // attachments: attachments || [],
          reply,
          type: type || "text",
          createdAt: new Date().toISOString(),
          pinned: false,
          sender: {
            _id: userId || "",
            id: userId || "",
            fullname: userFullname || "Unknown",
            avatar: userAvatar || "",
          },
          isMine: true,
          isRead: false,
        };
        // Thêm dữ liệu tạm vào messages để hiển thị ngay
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...get().messagesRoom[roomId],
              messages: [
                ...(get().messagesRoom[roomId]?.messages || []),
                {
                  ...data,
                  // Đánh dấu là tạm, ví dụ status: "pending"
                  status: "pending",
                },
              ],
            },
          },
        });

        // Sau đó mới gọi socket gửi lên
        socket?.emit("message:send", {
          roomId,
          type,
          content,
          replyTo,
          id,
        });
      },
    }),
    {
      name: "message-storage", // unique name
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useMessageStore;
