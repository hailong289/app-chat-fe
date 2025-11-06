import { create } from "zustand";
import { FilePreview, MessageState, MessageType } from "./types/message.state";
import useRoomStore from "./useRoomStore";
export interface SendMessageArgs {
  roomId: string;
  content: string;
  attachments: FilePreview[];
  type: "text" | "image" | "file" | "video";
  replyTo?: string;
  socket?: any; // Socket instance
  userId?: string; // User ID
  userFullname?: string; // User fullname
  userAvatar?: string; // User avatar
}
import { upsertOne } from "@/libs/crud";
import { db } from "@/libs/db";
import { ObjectId } from "bson";
import { createJSONStorage, persist } from "zustand/middleware";
import UploadService from "@/service/uploadfile.service";

const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      messagesRoom: {},
      readedRooms: {},

      upsetMsg: async (msgData: MessageType) => {
        if (!msgData.roomId) return;
        let lastMsgId: string | null = msgData.id ?? null;

        await upsertOne(db.messages, msgData);
        const prevRoom = get().messagesRoom[msgData.roomId] || {};
        const prevMessages = prevRoom.messages || [];
        msgData.status = msgData.status || "sent";
        // Tìm vị trí message theo id
        const idx = prevMessages.findIndex((m) => m.id === msgData.id);
        let newMessages;
        if (idx === -1) {
          // Nếu chưa có thì thêm mới
          newMessages = [...prevMessages, msgData];
        } else {
          // Nếu đã có thì cập nhật lại
          newMessages = [
            ...prevMessages.slice(0, idx),
            msgData,
            ...prevMessages.slice(idx + 1),
          ];
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
        if (msgData.isRead) {
          const roomStore = useRoomStore.getState();
          roomStore.setRoomReaded({
            lastMessageId: msgData.id,
            roomId: msgData.roomId,
          });
        }
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
        const roomStore = useRoomStore.getState();
        roomStore.setRoomReaded({
          lastMessageId: id,
          roomId: roomId,
        });
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
          attachments: attachments || [],
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
          isRead: true,
          status:
            attachments && attachments.length > 0 ? "uploading" : "pending",
        };

        // Thêm dữ liệu tạm vào messages để hiển thị ngay
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...get().messagesRoom[roomId],
              messages: [...(get().messagesRoom[roomId]?.messages || []), data],
            },
          },
        });

        // Upload attachments nếu có (background task)
        if (attachments && attachments.length > 0) {
          get()
            .uploadAttachments(roomId, id, attachments)
            .then((uploadedAttachments) => {
              console.log("🚀 ~ uploadedAttachments:", uploadedAttachments);
              console.log("✅ Upload complete, updating message...");

              // Sau khi upload xong, emit socket với URLs thật
              socket?.emit("message:send", {
                roomId,
                type,
                content,
                replyTo,
                id,
                attachments: uploadedAttachments.map((att) => att._id),
              });
            })
            .catch((error) => {
              console.error("❌ Upload failed:", error);
              // Update message status to failed
              const currentRoom = get().messagesRoom[roomId];
              const updatedMessages = (currentRoom?.messages || []).map((msg) =>
                msg.id === id ? { ...msg, status: "failed" as const } : msg
              );
              set({
                messagesRoom: {
                  ...get().messagesRoom,
                  [roomId]: {
                    ...currentRoom,
                    messages: updatedMessages,
                  },
                },
              });
            });
        } else {
          // Không có attachments, gửi ngay
          socket?.emit("message:send", {
            roomId,
            type,
            content,
            replyTo,
            id,
          });
        }
      },
      getMessageByRoomId: async (roomId: string) => {
        // Lấy từ IndexedDB
        const messages = await db.messages
          .where("roomId")
          .equals(roomId)
          .toArray();
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...get().messagesRoom[roomId],
              messages,
            },
          },
        });
      },
      markMessageAsRead: async (
        roomId: string,
        messageId: string,
        socket: any
      ) => {
        const roomStore = useRoomStore.getState();
        roomStore.setRoomReaded({
          lastMessageId: messageId,
          roomId: roomId,
        });
        socket?.emit("mark:read", {
          roomId,
          messageId,
        });
      },

      /**
       * Cập nhật progress của một attachment trong message
       */
      updateAttachmentProgress: (
        roomId: string,
        messageId: string,
        fileId: string,
        progress: number,
        status?: string
      ) => {
        const currentRoom = get().messagesRoom[roomId];
        if (!currentRoom?.messages) return;

        // Tìm message và cập nhật attachment progress
        const updatedMessages = currentRoom.messages.map((msg) => {
          if (msg.id !== messageId) return msg;

          const updatedAttachments = (msg.attachments || []).map((att) =>
            att._id === fileId
              ? {
                  ...att,
                  uploadProgress: progress,
                  ...(status && { status }),
                }
              : att
          );

          return {
            ...msg,
            attachments: updatedAttachments,
          };
        });

        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...currentRoom,
              messages: updatedMessages,
            },
          },
        });
      },

      /**
       * Upload tất cả attachments song song với progress tracking
       * @param roomId ID của room
       * @param messageId ID của message chứa attachments
       * @param attachments Danh sách FilePreview cần upload
       */
      uploadAttachments: async (
        roomId: string,
        messageId: string,
        attachments: FilePreview[]
      ) => {
        console.log("🚀 Starting upload for", attachments.length, "files");

        // Lọc chỉ những file chưa upload (có file property)
        const filesToUpload = attachments.filter((att) => att.file);

        if (filesToUpload.length === 0) {
          console.log("✅ No files to upload");
          return attachments;
        }

        // Log IDs để verify
        console.log(
          "📋 File IDs to upload:",
          filesToUpload.map((att) => ({
            name: att.name,
            _id: att._id,
          }))
        );

        // Đánh dấu tất cả là "uploading"
        for (const att of filesToUpload) {
          get().updateAttachmentProgress(
            roomId,
            messageId,
            att._id,
            0,
            "uploading"
          );
        }

        try {
          // Upload song song với progress tracking - sử dụng _id có sẵn của FilePreview
          const uploadedResults = await UploadService.uploadMultipleParallel(
            filesToUpload.map((att) => att.file!),
            {
              roomId,
              id: filesToUpload.map((att) => att._id), // Sử dụng _id có sẵn của FilePreview
              onEachProgress: (index, progress) => {
                const fileId = filesToUpload[index]._id;
                console.log(
                  `📤 Upload progress [${index}]:`,
                  progress,
                  "%",
                  filesToUpload[index].name
                );
                get().updateAttachmentProgress(
                  roomId,
                  messageId,
                  fileId,
                  progress,
                  "uploading"
                );
              },
            }
          );

          console.log("✅ All files uploaded:", uploadedResults);
          console.log("🔍 Verifying IDs match:");
          for (let idx = 0; idx < uploadedResults.length; idx++) {
            const result = uploadedResults[idx];
            const originalId = filesToUpload[idx]._id;
            const returnedId = result._id;
            const match = originalId === returnedId;
            console.log(
              `  File ${idx}: ${match ? "✅" : "❌"} ${originalId} ${
                match ? "===" : "!=="
              } ${returnedId}`
            );
            console.log(
              `    - Name: ${result.name}, Size: ${result.size} bytes, Type: ${result.mimeType}`
            );
          }

          // Cập nhật attachments với URL đã upload
          const updatedAttachments = attachments.map((att) => {
            const uploadIndex = filesToUpload.findIndex(
              (f) => f._id === att._id
            );
            if (uploadIndex === -1) return att; // File đã upload trước đó

            const uploadResult = uploadedResults[uploadIndex];

            // Revoke blob URL cũ
            if (att.url.startsWith("blob:")) {
              URL.revokeObjectURL(att.url);
            }

            return {
              ...att,
              // _id giữ nguyên (đã dùng att._id khi upload, server trả về cùng _id)
              uploadedUrl: uploadResult.url,
              url: uploadResult.url, // Update main URL từ server
              kind: uploadResult.kind || att.kind, // Cập nhật kind từ server
              name: uploadResult.name || att.name, // Cập nhật name từ server
              size: uploadResult.size || att.size, // Cập nhật size từ server
              mimeType: uploadResult.mimeType || att.mimeType, // Cập nhật mimeType từ server
              status: "uploaded",
              uploadProgress: 100,
              file: undefined, // Xóa file gốc sau khi upload
            } as FilePreview;
          });

          // Update attachments trong message
          const currentRoom = get().messagesRoom[roomId];
          const updatedMessages = (currentRoom?.messages || []).map((msg) =>
            msg.id === messageId
              ? { ...msg, attachments: updatedAttachments }
              : msg
          );

          set({
            messagesRoom: {
              ...get().messagesRoom,
              [roomId]: {
                ...currentRoom,
                messages: updatedMessages,
              },
            },
          });

          return updatedAttachments;
        } catch (error) {
          console.error("❌ Upload failed:", error);

          // Đánh dấu tất cả là "failed"
          for (const att of filesToUpload) {
            get().updateAttachmentProgress(
              roomId,
              messageId,
              att._id,
              0,
              "failed"
            );
          }

          throw error;
        }
      },
    }),
    {
      name: "message-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export default useMessageStore;
