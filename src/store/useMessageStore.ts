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
import { upsertOne, deleteOne } from "@/libs/crud";
import { db } from "@/libs/db";
import { ObjectId } from "bson";
import { createJSONStorage, persist } from "zustand/middleware";
import UploadService from "@/service/uploadfile.service";
import MessageService from "@/service/message.service";

const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      messagesRoom: {},
      readedRooms: {},

      upsetMsg: async (msgData: MessageType) => {
        if (!msgData.roomId) return;

        // Lưu vào IndexedDB trước
        msgData.status = "sent";
        // Lấy state hiện tại
        const prevRoom = get().messagesRoom[msgData.roomId] || {};
        const prevMessages = prevRoom.messages || [];

        // Tìm vị trí message theo id
        const existingIndex = prevMessages.findIndex(
          (m) => m.id === msgData.id
        );

        let updatedMessages: MessageType[];
        if (existingIndex === -1) {
          // ID không tồn tại → thêm vào cuối
          updatedMessages = [...prevMessages, msgData];
        } else {
          // ID đã tồn tại → cập nhật tại chỗ
          updatedMessages = prevMessages.map((msg, idx) =>
            idx === existingIndex ? msgData : msg
          );
        }

        // Cập nhật state
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [msgData.roomId]: {
              ...prevRoom,
              messages: updatedMessages,
              // Cập nhật last_message_id nếu tin đã đọc
              ...(msgData.isRead && { last_message_id: msgData.id }),
            },
          },
        });
        await upsertOne(db.messages, msgData);
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

      fetchNewMessages: async (roomId: string, lastMessageId?: string) => {
        try {
          set((state) => ({
            ...state,
            isLoading: true,
          }));

          // Lấy tin nhắn mới từ API
          const response = (await MessageService.getMessages({
            roomId,
            queryParams: {
              msgId: lastMessageId, // Lấy tin nhắn sau ID này
              limit: 50,
              type: "new",
            },
          })) as { data: { data: MessageType[] } };

          if (!response.data?.data || response.data.data.length === 0) {
            set((state) => ({ ...state, isLoading: false }));
            return;
          }

          const newMessages = response.data.data.map((msg: MessageType) => ({
            ...msg,
            roomId,
            isRead: true,
            status: (msg.status || "delivered") as MessageType["status"],
          }));

          // Lưu từng tin nhắn vào IndexedDB
          await Promise.all(
            newMessages.map((msg: MessageType) => upsertOne(db.messages, msg))
          );

          // Cập nhật state
          const currentRoom = get().messagesRoom[roomId] || {};
          const currentMessages = (currentRoom as any).messages || [];

          // Lọc ra những tin nhắn chưa có trong state
          const uniqueNewMessages = newMessages.filter(
            (newMsg: MessageType) =>
              !currentMessages.some((msg: MessageType) => msg.id === newMsg.id)
          );

          if (uniqueNewMessages.length > 0) {
            const lastNewMessageId =
              uniqueNewMessages[uniqueNewMessages.length - 1].id;

            // Cập nhật vào readedRooms nếu có tin nhắn mới
            set((state) => ({
              ...state,
              readedRooms: {
                ...state.readedRooms,
                [roomId]: lastNewMessageId,
              },
            }));

            // Cập nhật messages trong room
            set((state) => ({
              ...state,
              messagesRoom: {
                ...state.messagesRoom,
                [roomId]: {
                  messages: [...currentMessages, ...uniqueNewMessages],
                  input: currentRoom.input || null,
                  attachments: currentRoom.attachments || null,
                  ghim: currentRoom.ghim || null,
                  updatedAt: new Date().toISOString(),
                },
              },
              isLoading: false,
            }));
          } else {
            set((state) => ({ ...state, isLoading: false }));
          }
        } catch (error) {
          console.error("Error fetching new messages:", error);
          set((state) => ({
            ...state,
            isLoading: false,
          }));
          throw error;
        }
      },

      resendMessage: async (
        roomId: string,
        messageId: string,
        socket?: any
      ) => {
        const currentRoom = get().messagesRoom[roomId];
        if (!currentRoom?.messages) return;

        // Tìm message cần gửi lại
        const message = currentRoom.messages.find(
          (msg) => msg.id === messageId
        );
        if (!message) {
          console.error("❌ Message not found:", messageId);
          return;
        }

        // Cập nhật status về pending
        const updatedMessages = currentRoom.messages.map((msg) =>
          msg.id === messageId ? { ...msg, status: "pending" as const } : msg
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

        try {
          // Nếu có attachments, upload lại
          if (message.attachments && message.attachments.length > 0) {
            const uploadedAttachments = await get().uploadAttachments(
              roomId,
              messageId,
              message.attachments
            );

            // Emit socket với attachments đã upload
            socket?.emit("message:send", {
              roomId,
              type: message.type,
              content: message.content,
              replyTo: message.reply?._id,
              id: messageId,
              attachments: uploadedAttachments.map((att) => att._id),
            });
          } else {
            // Không có attachments, gửi ngay
            socket?.emit("message:send", {
              roomId,
              type: message.type,
              content: message.content,
              replyTo: message.reply?._id,
              id: messageId,
            });
          }

          console.log("✅ Message resent:", messageId);
        } catch (error) {
          console.error("❌ Resend failed:", error);

          // Cập nhật lại status về failed
          const failedMessages = get().messagesRoom[roomId]?.messages.map(
            (msg) =>
              msg.id === messageId ? { ...msg, status: "failed" as const } : msg
          );

          set({
            messagesRoom: {
              ...get().messagesRoom,
              [roomId]: {
                ...get().messagesRoom[roomId],
                messages: failedMessages || [],
              },
            },
          });
        }
      },

      getMessageByRoomId: async (roomId: string) => {
        // Lấy tất cả tin nhắn từ IndexedDB
        const allMessages = await db.messages
          .where("roomId")
          .equals(roomId)
          .toArray();

        // Sort theo ID (ObjectId có timestamp embedded, chính xác nhất)
        const sortedMessages = [...allMessages].sort((a, b) =>
          a.id.localeCompare(b.id)
        );

        const prevRoom = get().messagesRoom[roomId] || {};
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...prevRoom,
              messages: sortedMessages,
            },
          },
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
            console.log("🚀 ~ uploadResult:", uploadResult);

            // Revoke blob URL cũ
            if (att.url.startsWith("blob:")) {
              URL.revokeObjectURL(att.url);
            }

            return {
              ...att,
              // _id giữ nguyên (đã dùng att._id khi upload, server trả về cùng _id)
              _id: uploadResult._id,
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

      /**
       * Load older messages from API when local DB is exhausted
       * @param roomId - ID của room cần load tin nhắn
       * @param limit - Số lượng tin nhắn cần load (default 50)
       * @returns Promise<any[]> - Returns loaded messages or empty array if no more
       */
      loadOlderMessages: async (
        roomId: string,
        limit: number = 100
      ): Promise<any[]> => {
        const currentRoom = get().messagesRoom[roomId];
        if (!currentRoom?.messages || currentRoom.messages.length === 0) {
          console.warn("No messages in local, skip loading older messages");
          return [];
        }

        // Lấy ID của tin nhắn cũ nhất hiện có
        const oldestMessage = currentRoom.messages[0];
        const oldestMessageId = oldestMessage?.id;

        if (!oldestMessageId) {
          console.warn("No oldest message ID found");
          return [];
        }

        try {
          console.log(
            `🌐 Loading older messages before ID: ${oldestMessageId}`
          );

          // TODO: Gọi API để lấy tin nhắn cũ hơn
          // const response = await fetch(`/api/messages/${roomId}?before=${oldestMessageId}&limit=${limit}`);

          const result: any = await MessageService.getMessages({
            roomId,
            queryParams: {
              msgId: oldestMessageId,
              limit,
              type: "old",
            },
          });
          const olderMessages = result.data.metadata;
          // Mock data for now - bỏ sau khi có API thật
          console.log("⚠️ API loadOlderMessages chưa được implement");

          // Khi có API thật, uncomment code dưới:

          if (olderMessages && olderMessages.length > 0) {
            // Prepend messages cũ vào đầu array
            const updatedMessages = [...olderMessages, ...currentRoom.messages];

            // Cập nhật state
            set({
              messagesRoom: {
                ...get().messagesRoom,
                [roomId]: {
                  ...currentRoom,
                  messages: updatedMessages,
                },
              },
            });

            // Lưu vào IndexedDB
            for (const msg of olderMessages) {
              await upsertOne(db.messages, msg);
            }

            console.log(
              `✅ Loaded ${olderMessages.length} older messages from API`
            );

            return olderMessages; // Return messages for caller to check
          } else {
            console.log("📭 No more older messages from server");
            return []; // Return empty array if no messages
          }
        } catch (error) {
          console.error("❌ Error loading older messages:", error);
          throw error;
        }
      },

      /**
       * Delete a message
       */
      deleteMessage: async (roomId: string, messageId: string) => {
        try {
          // Call API to delete
          // await MessageService.deleteMessage(roomId, messageId);

          // Remove from local state
          const currentRoom = get().messagesRoom[roomId];
          if (currentRoom) {
            const updatedMessages = currentRoom.messages.filter(
              (msg) => msg.id !== messageId
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

            // Update IndexedDB
            await deleteOne(db.messages, messageId);
            console.log("✅ Message deleted:", messageId);
          }
        } catch (error) {
          console.error("❌ Error deleting message:", error);
        }
      },

      /**
       * Recall a message (chỉ trong 30 phút)
       */
      recallMessage: async (roomId: string, messageId: string) => {
        try {
          // Call API to recall
          // await MessageService.recallMessage(roomId, messageId);

          // Update message status to "recalled"
          const currentRoom = get().messagesRoom[roomId];
          if (currentRoom) {
            const updatedMessages = currentRoom.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    status: "recalled" as MessageType["status"],
                    content: "[Tin nhắn đã bị thu hồi]",
                  }
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

            // Update IndexedDB
            const msg = currentRoom.messages.find((m) => m.id === messageId);
            if (msg) {
              await upsertOne(db.messages, {
                ...msg,
                status: "recalled" as MessageType["status"],
                content: "[Tin nhắn đã bị thu hồi]",
              });
            }
            console.log("✅ Message recalled:", messageId);
          }
        } catch (error) {
          console.error("❌ Error recalling message:", error);
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
