import { create } from "zustand";
import { FilePreview, MessageState, MessageType } from "./types/message.state";
export interface SendMessageArgs {
  roomId: string;
  content: string;
  attachments: FilePreview[];
  type: "text" | "image" | "file" | "system" | "video" | "audio" | "gif";
  replyTo?: string;
  socket?: any; // Socket instance
  userId?: string; // User ID
  userFullname?: string; // User fullname
  userAvatar?: string; // User avatar
}
import { upsertOne, deleteOne, upsertMany } from "@/libs/crud";
import { db } from "@/libs/db";
import { ObjectId } from "bson";
import UploadService from "@/service/uploadfile.service";
import MessageService from "@/service/message.service";

/**
 * Sanitize message data before saving to IndexedDB
 * Remove File objects and other non-serializable data
 * Deep clone to avoid circular references and ensure clean data
 */
const sanitizeMessageForDB = (msg: MessageType): MessageType => {
  try {
    // Create a clean copy using JSON parse/stringify to remove circular refs
    const cleanMsg = JSON.parse(
      JSON.stringify({
        ...msg,
        attachments: msg.attachments?.map((att) => ({
          _id: att._id,
          kind: att.kind,
          url: att.url,
          name: att.name,
          size: att.size,
          mimeType: att.mimeType,
          thumbUrl: att.thumbUrl,
          width: att.width,
          height: att.height,
          duration: att.duration,
          status: att.status,
          uploadProgress: att.uploadProgress,
          uploadedUrl: att.uploadedUrl,
          // Explicitly exclude file and any non-serializable data
        })),
        // Ensure sender is clean
        sender: msg.sender
          ? {
              _id: msg.sender._id,
              fullname: msg.sender.fullname,
              avatar: msg.sender.avatar,
            }
          : undefined,
        // Ensure content is a clean string
        content: msg.content ? String(msg.content) : "",
      })
    );

    return cleanMsg;
  } catch (error) {
    console.error("❌ Error sanitizing message for DB:", error, msg);
    // Return a minimal valid message if sanitization fails
    return {
      ...msg,
      content: msg.content ? String(msg.content) : "",
      attachments: [],
      sender: msg.sender
        ? {
            _id: msg.sender._id,
            fullname: msg.sender.fullname || "Unknown",
            avatar: msg.sender.avatar,
          }
        : undefined,
    } as MessageType;
  }
};

/**
 * Sanitize attachments from API response
 * Remove any non-serializable data that might come from server
 */
const sanitizeAttachmentsFromAPI = (
  attachments?: FilePreview[]
): FilePreview[] | undefined => {
  if (!attachments) return undefined;

  return attachments.map((att) => ({
    _id: att._id,
    kind: att.kind,
    url: att.url,
    name: att.name,
    size: att.size,
    mimeType: att.mimeType,
    thumbUrl: att.thumbUrl,
    width: att.width,
    height: att.height,
    duration: att.duration,
    status: att.status,
    uploadProgress: att.uploadProgress,
    uploadedUrl: att.uploadedUrl,
    // Explicitly exclude: file, and any other unknown properties
  }));
};

const useMessageStore = create<MessageState>()((set, get) => ({
  isLoading: false,
  messagesRoom: {},
  readedRooms: {},

  upsetMsg: async (msgData: MessageType) => {
    if (!msgData.roomId) return;

    // Lưu vào IndexedDB trước
    msgData.status = "sent";
    // Lấy state hiện tại
    const prevRoom = get().messagesRoom[msgData.roomId] || {
      messages: [],
      reply: null,
    };
    const prevMessages = prevRoom.messages || [];

    // Tìm vị trí message theo id
    const existingIndex = prevMessages.findIndex((m) => m.id === msgData.id);

    let updatedMessages: MessageType[];
    if (existingIndex === -1) {
      // ID không tồn tại → thêm vào cuối
      updatedMessages = [...prevMessages, msgData];
    } else {
      // ID đã tồn tại → cập nhật tại chỗ
      if (
        Array.isArray(msgData.attachments) &&
        msgData.attachments.length > 0
      ) {
        // Cập nhật các trường mới cho attachment, giữ nguyên attachment cũ nếu không có _id trùng
        const prevAttachments = prevMessages[existingIndex].attachments || [];
        msgData.attachments = msgData.attachments.map((newAtt) => {
          const oldAtt = prevAttachments.find((att) => att._id === newAtt._id);
          return oldAtt
            ? { ...oldAtt, ...newAtt } // merge, ưu tiên trường mới
            : newAtt; // nếu không có thì giữ nguyên newAtt
        });
      }
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
    const prevRoom = get().messagesRoom[roomId] || {
      messages: [],
      reply: null,
    };

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
          isMine: !!foundReply.isMine,
          hiddenByMe: false,
          isDeleted: false,
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
      status: attachments && attachments.length > 0 ? "uploading" : "pending",
      hiddenByMe: false,
      hiddenAt: null,
      isDeleted: false,
    };

    // Thêm dữ liệu tạm vào messages để hiển thị ngay
    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: {
          ...prevRoom,
          messages: [...(prevRoom.messages || []), data],
        },
      },
    });
    // Upload attachments nếu có (background task)
    if (attachments && attachments.length > 0) {
      get()
        .uploadAttachments({ roomId, messageId: id, attachments })
        .then((uploadedAttachments) => {
          // Only send attachments that were uploaded successfully.
          const successful = (uploadedAttachments || []).filter(
            (a) => a?.status === "uploaded"
          );

          if (successful.length === uploadedAttachments.length) {
            socket?.emit("message:send", {
              roomId,
              type,
              content,
              replyTo,
              id,
              attachments: uploadedAttachments.map((att) => att._id),
            });
            get().autoMarkMessageSent(roomId, id, 3000);
          } else {
            console.warn(
              "⚠️ All attachments failed to upload — marking message failed",
              id
            );
            // mark message as failed in UI
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
          }
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
      get().autoMarkMessageSent(roomId, id, 3000);
    }
  },

  fetchNewMessages: async (roomId: string, lastMessageId?: string) => {
    try {
      set((state) => ({
        ...state,
        isLoading: true,
      }));

      // Validate inputs
      if (!roomId) {
        console.warn("⚠️ fetchNewMessages: roomId is required");
        set((state) => ({ ...state, isLoading: false }));
        return;
      }

      // Lấy tin nhắn mới từ API
      const response = (await MessageService.getMessages({
        roomId,
        queryParams: {
          msgId: lastMessageId, // Lấy tin nhắn sau ID này
          limit: 50,
          type: "new",
        },
      })) as { data: { metadata: MessageType[] } };

      console.log("🚀 ~ fetchNewMessages response:", response);

      // Validate response structure
      if (!response?.data?.metadata || !Array.isArray(response.data.metadata)) {
        console.warn("⚠️ Invalid response structure from API:", response);
        set((state) => ({ ...state, isLoading: false }));
        return;
      }

      if (response.data.metadata.length === 0) {
        console.log("📭 No new messages from API");
        set((state) => ({ ...state, isLoading: false }));
        return;
      }

      // Map và sanitize messages từ API
      const newMessages = response.data.metadata.map((msg: MessageType) => ({
        ...msg,
        roomId,
        isRead: true,
        status: (msg.status || "delivered") as MessageType["status"],
        attachments: sanitizeAttachmentsFromAPI(msg.attachments),
      }));

      // Lưu từng tin nhắn vào IndexedDB
      await Promise.all(
        newMessages.map((msg: MessageType) =>
          upsertOne(db.messages, sanitizeMessageForDB(msg))
        )
      );

      // Cập nhật state
      const currentRoom = get().messagesRoom[roomId] || {
        messages: [],
        input: null,
        attachments: null,
        reply: null,
      };
      const currentMessages = currentRoom.messages || [];

      // Lọc ra những tin nhắn chưa có trong state
      const uniqueNewMessages = newMessages.filter(
        (newMsg: MessageType) =>
          !currentMessages.some((msg: MessageType) => msg.id === newMsg.id)
      );

      if (uniqueNewMessages.length > 0) {
        // Cập nhật messages trong room
        set((state) => ({
          ...state,
          messagesRoom: {
            ...state.messagesRoom,
            [roomId]: {
              ...currentRoom,
              messages: [...currentMessages, ...uniqueNewMessages],
            },
          },
          isLoading: false,
        }));

        console.log(`✅ Added ${uniqueNewMessages.length} new messages`);
      } else {
        console.log("ℹ️ All messages already exist in state");
        set((state) => ({ ...state, isLoading: false }));
      }
    } catch (error) {
      console.error("❌ Error fetching new messages:", error);
      set((state) => ({
        ...state,
        isLoading: false,
      }));
      // Don't throw error to prevent UI from breaking
    }
  },

  resendMessage: async (roomId: string, messageId: string, socket?: any) => {
    const state = get();
    const currentRoom = state.messagesRoom[roomId];
    if (!currentRoom?.messages) return;

    // Tìm message cần gửi lại
    const message = currentRoom.messages.find((msg) => msg.id === messageId);
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
        ...state.messagesRoom,
        [roomId]: {
          ...currentRoom,
          messages: updatedMessages,
        },
      },
    });

    try {
      // ====== KHÔNG CÓ ATTACHMENTS -> GỬI LẠI LUÔN (giống sendMessage) ======
      if (!message.attachments || message.attachments.length === 0) {
        socket?.emit("message:send", {
          roomId,
          type: message.type,
          content: message.content,
          replyTo: message.reply?._id,
          id: messageId,
        });

        get().autoMarkMessageSent(roomId, messageId, 3000);
        console.log("✅ Message resent (no attachments):", messageId);
        return;
      }

      // ====== CÓ ATTACHMENTS ======
      const allAttachments = message.attachments;

      // Attach đã FAILED -> cần upload lại
      const hasFailed = allAttachments.some((att) => att.status === "failed");

      let finalAttachments = allAttachments;

      if (hasFailed) {
        // Chỉ re-upload những cái failed:
        // uploadAttachments vốn chỉ upload những cái có `file`,
        // nên để chắc kèo ta clear `file` cho những cái không failed.
        const uploadInput = allAttachments.map((att) =>
          att.status === "failed" ? att : { ...att, file: undefined }
        );

        const uploadedAttachments = await get().uploadAttachments({
          roomId,
          messageId,
          attachments: uploadInput,
        });

        finalAttachments = uploadedAttachments;
      } else {
        // Không còn cái nào failed -> dùng lại attachments hiện tại trong state (refresh)
        const refreshedRoom = get().messagesRoom[roomId];
        const refreshedMsg = refreshedRoom?.messages.find(
          (m) => m.id === messageId
        );
        finalAttachments = refreshedMsg?.attachments || allAttachments;
      }

      // Lấy các attachments đã upload thành công
      const successful = (finalAttachments || []).filter(
        (a) => a?.status === "uploaded"
      );

      // 🔥 GIỐNG LOGIC sendMessage:
      // Nếu tất cả đều uploaded -> emit
      // Nếu không -> mark message failed
      if (successful.length === finalAttachments.length) {
        socket?.emit("message:send", {
          roomId,
          type: message.type,
          content: message.content,
          replyTo: message.reply?._id,
          id: messageId,
          attachments: successful.map((att) => att._id),
        });

        get().autoMarkMessageSent(roomId, messageId, 3000);

        console.log("✅ Message resent:", messageId);
      } else {
        console.warn(
          "⚠️ Some or all attachments failed to upload on resend — marking message failed",
          messageId
        );

        const failedMessages = get().messagesRoom[roomId]?.messages.map((msg) =>
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
    } catch (error) {
      console.error("❌ Resend failed:", error);

      // Cập nhật lại status về failed
      const current = get().messagesRoom[roomId];
      const failedMessages = current?.messages.map((msg) =>
        msg.id === messageId ? { ...msg, status: "failed" as const } : msg
      );

      set({
        messagesRoom: {
          ...get().messagesRoom,
          [roomId]: {
            ...current,
            messages: failedMessages || [],
          },
        },
      });
    }
  },

  /**
   * Lấy danh sách tin nhắn từ API, upsert vào IndexedDB và state
   * @param roomId - ID của room
   * @param queryParams - Tham số query (msgId, limit, type)
   * @returns Promise<MessageType[]> - Danh sách tin nhắn đã lấy
   */
  fetchMessagesFromAPI: async (
    roomId: string,
    queryParams?: {
      limit?: number;
    }
  ): Promise<MessageType[]> => {
    try {
      // Validate roomId
      if (!roomId) {
        console.warn("⚠️ fetchMessagesFromAPI: roomId is required");
        return [];
      }

      console.log(
        `🌐 Fetching messages from API for room: ${roomId}`,
        queryParams
      );

      // Gọi API lấy tin nhắn
      const response = (await MessageService.getMessages({
        roomId,
        queryParams: {
          limit: queryParams?.limit || 100,
        },
      })) as { data: { metadata: MessageType[] } };

      // Validate response structure
      if (!response?.data?.metadata || !Array.isArray(response.data.metadata)) {
        console.warn("⚠️ Invalid response structure from API:", response);
        return [];
      }

      if (response.data.metadata.length === 0) {
        console.log("📭 No messages returned from API");
        return [];
      }

      // Map và sanitize messages từ API
      const messages = response.data.metadata.map((msg: MessageType) => ({
        ...msg,
        roomId,
        status: (msg.status || "delivered") as MessageType["status"],
        attachments: sanitizeAttachmentsFromAPI(msg.attachments),
      }));

      console.log(`✅ Fetched ${messages.length} messages from API`);

      // Upsert từng tin nhắn vào IndexedDB (đã được sanitize)
      await Promise.all(
        messages.map((msg: MessageType) =>
          upsertOne(db.messages, sanitizeMessageForDB(msg))
        )
      );

      console.log(`💾 Saved ${messages.length} messages to IndexedDB`);

      // Lấy room hiện tại và merge messages
      const currentRoom = get().messagesRoom[roomId] || {
        messages: [],
        input: null,
        attachments: null,
        reply: null,
      };
      const currentMessages = currentRoom.messages || [];

      // Merge messages: loại bỏ duplicate dựa trên ID
      const mergedMessages = [...currentMessages];
      for (const newMsg of messages) {
        const existingIndex = mergedMessages.findIndex(
          (m) => m.id === newMsg.id
        );
        if (existingIndex === -1) {
          mergedMessages.push(newMsg);
        } else {
          // Cập nhật message nếu đã tồn tại
          mergedMessages[existingIndex] = newMsg;
        }
      }

      // Sort theo ID (ObjectId có timestamp embedded)
      const sortedMessages = [...mergedMessages].sort((a, b) =>
        a.id.localeCompare(b.id)
      );

      // Cập nhật state
      set({
        messagesRoom: {
          ...get().messagesRoom,
          [roomId]: {
            ...currentRoom,
            messages: sortedMessages,
          },
        },
      });

      console.log(
        `🔄 Updated state with ${sortedMessages.length} total messages`
      );

      return messages;
    } catch (error) {
      // console.error("❌ Error fetching messages from API:", error);
      // Don't throw error, return empty array to prevent UI breaking
      return [];
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

    const prevRoom = get().messagesRoom[roomId] || {
      messages: [],
      input: null,
      attachments: null,
      reply: null,
    };

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
  uploadAttachments: async ({
    roomId,
    messageId,
    attachments,
  }: {
    roomId: string;
    messageId: string;
    attachments: FilePreview[];
  }) => {
    // Lọc chỉ những file chưa upload (có file property)
    const filesToUpload = attachments.filter((att) => att.file);

    if (filesToUpload.length === 0) {
      console.log("✅ No files to upload");
      return attachments;
    }

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

    // === PHẦN DÙNG Promise.all ĐỂ UPLOAD SONG SONG ===
    const uploadPromises = filesToUpload.map((att, index) =>
      UploadService.uploadSingleWithProgress(att.file!, {
        roomId,
        id: att._id,
        messageId,
        onProgress: (pct) => {
          get().updateAttachmentProgress(
            roomId,
            messageId,
            att._id,
            pct,
            "uploading"
          );
        },
      })
        .then((resp) => {
          const data = resp.data;
          console.log(`✅ Uploaded file ${index}:`, data);
          return {
            success: true as const,
            result: data,
            index,
            id: att._id,
          };
        })
        .catch((err) => {
          const e = err as any;

          // Log chi tiết lỗi
          try {
            console.error(
              `⚠️ Upload error for file index ${index} (id=${att._id}):`,
              {
                message: e?.message || String(e),
                name: e?.name,
                stack: e?.stack,
                responseData: e?.response?.data,
                responseStatus: e?.response?.status,
                request: e?.request,
                rawProps: Object.getOwnPropertyNames(e || {}).reduce(
                  (acc, k) => {
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      acc[k] = e[k];
                    } catch {
                      acc[k] = "<unserializable>";
                    }
                    return acc;
                  },
                  {} as Record<string, any>
                ),
              }
            );
          } catch (logErr) {
            console.error("⚠️ Error serializing upload error:", logErr, err);
          }

          // Mark failed
          get().updateAttachmentProgress(
            roomId,
            messageId,
            att._id,
            0,
            "failed"
          );

          // Quan trọng: luôn resolve, không throw -> Promise.all sẽ không reject
          return {
            success: false as const,
            error: err,
            index,
            id: att._id,
          };
        })
    );

    // Promise.all luôn resolve vì từng promise đã catch rồi
    const perFileResults = await Promise.all(uploadPromises);

    // Build updated attachments array dựa theo perFileResults
    const updatedAttachments = attachments.map((att) => {
      const fileIdx = filesToUpload.findIndex((f) => f._id === att._id);
      if (fileIdx === -1) return att; // attachment không upload (ví dụ: đã uploaded từ trước)

      const res = perFileResults.find((r) => r.id === att._id);
      if (!res) {
        return { ...att, status: "failed", uploadProgress: 0 } as FilePreview;
      }

      if (!res.success) {
        const errObj = res.error;
        const uploadError = {
          message: errObj?.message || String(errObj),
          responseData: errObj?.response?.data,
          responseStatus: errObj?.response?.status,
        };

        return {
          ...att,
          status: "failed",
          uploadProgress: 0,
          uploadError,
        } as FilePreview;
      }

      const uploadResult = res.result;

      // Revoke old blob URL
      if (att.url?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(att.url);
        } catch {
          // ignore
        }
      }

      return {
        ...att,
        _id: uploadResult._id || att._id,
        uploadedUrl: uploadResult.url,
        url: uploadResult.url,
        kind: uploadResult.kind || att.kind,
        name: uploadResult.name || att.name,
        size: uploadResult.size || att.size,
        mimeType: uploadResult.mimeType || att.mimeType,
        status: "uploaded",
        uploadProgress: 100,
      } as FilePreview;
    });

    // Update attachments trong message
    const currentRoom = get().messagesRoom[roomId];
    const updatedMessages = (currentRoom?.messages || []).map((msg) =>
      msg.id === messageId ? { ...msg, attachments: updatedAttachments } : msg
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

    // Log summary
    const successCount = perFileResults.filter((r) => r.success).length;
    const failCount = perFileResults.length - successCount;
    console.log(
      `✅ Upload summary: ${successCount} succeeded, ${failCount} failed`
    );

    return updatedAttachments;
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
      console.log(`🌐 Loading older messages before ID: ${oldestMessageId}`);

      // Gọi API để lấy tin nhắn cũ hơn
      const result: any = await MessageService.getMessages({
        roomId,
        queryParams: {
          msgId: oldestMessageId,
          limit,
          type: "old",
        },
      });

      const rawMessages = result.data.metadata;

      // Sanitize messages từ API
      const olderMessages =
        rawMessages?.map((msg: MessageType) => ({
          ...msg,
          attachments: sanitizeAttachmentsFromAPI(msg.attachments),
        })) || [];

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
          await upsertOne(db.messages, sanitizeMessageForDB(msg));
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
          await upsertOne(
            db.messages,
            sanitizeMessageForDB({
              ...msg,
              status: "recalled" as MessageType["status"],
              content: "[Tin nhắn đã bị thu hồi]",
            })
          );
        }
        console.log("✅ Message recalled:", messageId);
      }
    } catch (error) {
      console.error("❌ Error recalling message:", error);
    }
  },

  setReplyMessage: (roomId: string, message: MessageType | null) => {
    console.log("🚀 ~ message:", message);
    const currentRoom = get().messagesRoom[roomId] || {
      messages: [],
      input: null,
      attachments: null,
      reply: null,
    };

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: {
          ...currentRoom,
          reply: message,
        },
      },
    });
  },

  setInput: (roomId: string, input: string | null) => {
    const currentRoom = get().messagesRoom[roomId] || {
      messages: [],
      input: null,
      attachments: null,
      reply: null,
    };

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: {
          ...currentRoom,
          input,
        },
      },
    });
  },

  setAttachments: (roomId: string, attachments: FilePreview[] | null) => {
    const currentRoom = get().messagesRoom[roomId] || {
      messages: [],
      input: null,
      attachments: null,
      reply: null,
    };

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: {
          ...currentRoom,
          attachments,
        },
      },
    });
  },
  upsetMsgError: async (payload: {
    message: string;
    error: string;
    data: {
      userId?: string;
      roomId: string;
      type: string;
      content: string;
      attachments?: Array<string>;
      replyTo: string;
      id?: string;
    };
  }) => {
    const { roomId, id } = payload.data;

    if (!roomId || !id) return false;

    const state = get();
    const prevRoom = state.messagesRoom[roomId] || {
      messages: [] as MessageType[],
      reply: null,
    };

    const prevMessages = prevRoom.messages || [];
    const existingIndex = prevMessages.findIndex((m) => m.id === id);

    // Nếu không tìm thấy message → không làm gì
    if (existingIndex === -1) {
      console.warn(
        "[upsetMsgError] message not found for id:",
        id,
        "room:",
        roomId
      );
      return false;
    }

    const prevMsg = prevMessages[existingIndex];

    // Cập nhật attachments bị lỗi (nếu có truyền lên)
    let nextAttachments = prevMsg.attachments;
    if (
      payload.data.attachments &&
      payload.data.attachments.length > 0 &&
      prevMsg.attachments
    ) {
      const errorIds = new Set(payload.data.attachments);

      nextAttachments = prevMsg.attachments.map((file) => {
        // so sánh theo _id (hoặc nếu bạn dùng field khác thì sửa lại)
        const key = file._id || file.name;
        if (key && errorIds.has(key)) {
          return {
            ...file,
            status: "failed",
            uploadError: "Upload failed", // có thể truyền msgError thật từ BE
          };
        }
        return file;
      });
    }

    const updatedMsg: MessageType = {
      ...prevMsg,
      // nếu BE sửa content/type, thì ưu tiên cái mới
      content: payload.data.content ?? prevMsg.content,
      type: (payload.data.type as MessageType["type"]) ?? prevMsg.type,
      status: "failed",
      attachments: nextAttachments,
      // optional: nếu muốn lưu thời gian fail riêng thì thêm field khác
    };

    const updatedMessages = prevMessages.map((m, idx) =>
      idx === existingIndex ? updatedMsg : m
    );

    // update state
    set({
      messagesRoom: {
        ...state.messagesRoom,
        [roomId]: {
          ...prevRoom,
          messages: updatedMessages,
        },
      },
    });

    // update IndexedDB
    try {
      await upsertOne(db.messages, sanitizeMessageForDB(updatedMsg));
      return true;
    } catch (error) {
      console.error("[upsetMsgError] IndexedDB upsert error:", error);
      return false;
    }
  },
  autoMarkMessageSent: (roomId: string, messageId: string, delayMs = 3000) => {
    setTimeout(() => {
      const state = get();
      const currentRoom = state.messagesRoom[roomId];
      if (!currentRoom) return;

      const updatedMessages = (currentRoom.messages || []).map((msg) => {
        if (msg.id !== messageId) return msg;

        // Nếu đã failed thì giữ nguyên
        if (msg.status === "failed") return msg;

        // Chỉ auto-set sent nếu vẫn pending / uploading / undefined
        if (
          msg.status === "pending" ||
          msg.status === "uploading" ||
          !msg.status
        ) {
          return { ...msg, status: "sent" as const };
        }
        upsertOne(db.messages, msg);
        return msg;
      });

      set({
        messagesRoom: {
          ...state.messagesRoom,
          [roomId]: {
            ...currentRoom,
            messages: updatedMessages,
          },
        },
      });
    }, delayMs);
  },
}));

export default useMessageStore;
