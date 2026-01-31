import { create } from "zustand";
import {
  FilePreview,
  GalleryItem,
  MessageState,
  MessageSummary,
  MessageType,
  MessageTranslation,
  RoomData,
} from "./types/message.state";
import { groupMessagesByDate } from "@/libs/timeline-helpers";
import i18n from "@/i18n";
import useAuthStore from "./useAuthStore";
import useRoomStore from "./useRoomStore";
import { roomType } from "./types/room.state";

// Helper to get all messages from groups
const getAllMessagesFromGroups = (roomData?: RoomData): MessageType[] => {
  if (!roomData?.groups) return [];
  return roomData.groups.flatMap((g) => g.messages);
};

const updateRoomDataWithGroups = (
  prevRoom: RoomData | undefined,
  newMessages: MessageType[],
  lastReadId: string | null | undefined,
  newDisplayedCount?: number,
): RoomData => {
  const count = newDisplayedCount ?? prevRoom?.displayedMessagesCount ?? 20;

  // Filter messages hidden by current user
  const currentUser = useAuthStore.getState().user;
  const currentUserId = currentUser?._id;

  const displayableMessages = newMessages.filter((msg) => {
    if (currentUserId && msg.hiddenBy?.includes(currentUserId)) {
      return false;
    }
    return true;
  });

  // Deduplicate messages by ID to prevent infinite loops/duplicate rendering
  const uniqueMessagesMap = new Map<string, MessageType>();
  displayableMessages.forEach((msg) => {
    uniqueMessagesMap.set(msg.id, msg);
  });
  const uniqueMessages = Array.from(uniqueMessagesMap.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const groups = groupMessagesByDate(uniqueMessages, lastReadId);

  if (newMessages.length > uniqueMessages.length) {
    console.log(
      `🚀 ~ updateRoomDataWithGroups ~ Deduplicated: ${newMessages.length} -> ${uniqueMessages.length}`,
    );
  }
  console.log(
    `🚀 ~ updateRoomDataWithGroups ~ Groups: ${groups.length} - Total Msgs: ${uniqueMessages.length} - DisplayCount: ${count}`,
  );

  return {
    ...(prevRoom || {
      input: null,
      attachments: null,
      reply: null,
      lastReadMessageId: null,
      groups: [],
      displayedMessagesCount: 20,
      read_by_count: 0,
    }),
    groups: groups,
    displayedMessagesCount: count,
    lastReadMessageId: lastReadId,
  } as RoomData; // Cast to match new interface without messages
};

export interface SendMessageArgs {
  roomId: string;
  content: string;
  attachments: FilePreview[];
  type:
    | "text"
    | "image"
    | "file"
    | "system"
    | "video"
    | "audio"
    | "gif"
    | "document";
  replyTo?: string;
  socket?: any; // Socket instance
  userId?: string; // User ID
  userFullname?: string; // User fullname
  userAvatar?: string; // User avatar
  documentId?: string; // Document ID
}
import { upsertOne, deleteOne } from "@/libs/crud";
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
    // Create a clean copy using structuredClone to remove circular refs
    const cleanMsg = structuredClone({
      ...msg,
      // Ensure hiddenBy is preserved if it exists
      hiddenBy: msg.hiddenBy || [],
      // Ensure reply has new fields
      reply: msg.reply
        ? {
            ...msg.reply,
            hiddenBy: msg.reply.hiddenBy || [],
            isDelete: msg.reply.isDelete, // From pipeline
          }
        : undefined,
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
        summary: att.summary, // Keep summary
        // Explicitly exclude file and any non-serializable data
      })),
      // Ensure sender is always valid
      sender: msg.sender
        ? {
            _id: msg.sender._id,
            id: msg.sender.id,
            fullname: msg.sender.fullname,
            avatar: msg.sender.avatar,
          }
        : {
            _id: "unknown",
            id: "unknown",
            fullname: "Unknown",
            avatar: "",
          },
      // Ensure content is a clean string
      content: msg.content ? String(msg.content) : "",
    });

    return cleanMsg;
  } catch (error) {
    console.error("❌ Error sanitizing message for DB:", error);
    // Return a minimal valid message if sanitization fails
    return {
      ...msg,
      content: msg.content ? String(msg.content) : "",
      attachments: [],
      sender: msg.sender
        ? {
            _id: msg.sender._id,
            id: msg.sender.id,
            fullname: msg.sender.fullname || "Unknown",
            avatar: msg.sender.avatar,
          }
        : {
            _id: "unknown",
            fullname: "Unknown",
            avatar: "",
          },
    } as MessageType;
  }
};

/**
 * Sanitize attachments from API response
 * Remove any non-serializable data that might come from server
 */
const sanitizeAttachmentsFromAPI = (
  attachments?: FilePreview[],
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
    summary: att.summary, // Keep summary
    // Explicitly exclude: file, and any other unknown properties
  }));
};

const useMessageStore = create<MessageState>()((set, get) => ({
  isLoading: false,
  messagesRoom: {},
  readedRooms: {},

  upsetMsg: async (msgData: MessageType) => {
    console.log("🚀 ~ msgData:", msgData);
    // Ensure createdAt exists
    if (!msgData.createdAt) {
      msgData.createdAt = new Date().toISOString();
    }

    // Lưu vào IndexedDB trước
    msgData.status = "sent";

    // Normalize roomId: Socket may send MongoDB _id but frontend uses room.id (UUID)
    // Look up the room by _id to get the correct id for storage
    const roomStore = useRoomStore.getState();
    const roomFromStore = roomStore.rooms.find(
      (r) =>
        r._id === msgData.roomId ||
        r.roomId === msgData.roomId ||
        r.id === msgData.roomId,
    );
    // Use room.id if found, otherwise fallback to msgData.roomId
    const normalizedRoomId = roomFromStore?.id || msgData.roomId;
    console.log(
      `🚀 ~ upsetMsg ~ normalizedRoomId: ${normalizedRoomId} (from msgData.roomId: ${msgData.roomId})`,
    );

    // Pre-check if this is a new message (for use outside the set callback)
    const prevRoomForCheck = get().messagesRoom[normalizedRoomId];
    const prevMessagesForCheck = getAllMessagesFromGroups(prevRoomForCheck);
    const isNewMessage = !prevMessagesForCheck.some((m) => m.id === msgData.id);

    // Use set callback for atomic update to prevent race conditions
    set((state) => {
      const prevRoom = state.messagesRoom[normalizedRoomId] || {
        groups: [],
        displayedMessagesCount: 20,
        reply: null,
      };

      // Get messages using helper
      const prevMessages = getAllMessagesFromGroups(prevRoom);

      // Tìm vị trí message theo id
      const existingIndex = prevMessages.findIndex((m) => m.id === msgData.id);
      console.log(
        `🚀 ~ upsetMsg ~ normalizedRoomId: ${normalizedRoomId} - prevMsgs: ${prevMessages.length} - existingIndex: ${existingIndex} - new? ${existingIndex === -1}`,
      );

      let updatedMessages: MessageType[];
      if (existingIndex === -1) {
        // ID không tồn tại → thêm vào array
        updatedMessages = [...prevMessages, msgData];
      } else {
        // ID đã tồn tại → cập nhật
        updatedMessages = prevMessages.map((msg, idx) =>
          idx === existingIndex ? { ...msg, ...msgData } : msg,
        );
      }

      // Nếu là tin nhắn mới, tăng displayedCount lên 1
      const prevCount = prevRoom.displayedMessagesCount || 20;
      const increment = existingIndex === -1 ? 1 : 0;
      const newDisplayedCount = prevCount + increment;

      console.log(
        `🚀 ~ upsetMsg ~ updating displayedCount: ${prevCount} -> ${newDisplayedCount}`,
      );

      return {
        messagesRoom: {
          ...state.messagesRoom,
          [normalizedRoomId]: updateRoomDataWithGroups(
            prevRoom,
            updatedMessages,
            prevRoom.lastReadMessageId,
            newDisplayedCount,
          ),
        },
      };
    });

    // Update Room Store Optimistically
    try {
      const roomStore = useRoomStore.getState();
      const targetRoom =
        roomStore.getRoomByRoomId(msgData.roomId) ||
        roomStore.rooms.find((r) => r.id === normalizedRoomId);

      if (targetRoom) {
        const currentUser = useAuthStore.getState().user;
        const isMine = msgData.sender.id === currentUser?._id;

        let snippet = msgData.content || "";
        // Safe check for snippet type
        if (msgData.type === "image") {
          snippet = i18n.t("chat.message.type.image") || "[Image]";
        } else if (
          msgData.type === "file" ||
          msgData.type === "document" ||
          msgData.type === "video"
        ) {
          snippet = i18n.t("chat.message.type.file") || "[File]";
        } else if (msgData.attachments && msgData.attachments.length > 0) {
          const firstAtt = msgData.attachments[0];
          // FilePreview has mimeType, kind, but not type usually.
          if (
            firstAtt.mimeType?.startsWith("image") ||
            firstAtt.kind === "image"
          ) {
            snippet = i18n.t("chat.message.type.image") || "[Image]";
          } else {
            snippet = i18n.t("chat.message.type.file") || "[File]";
          }
        }

        const roomLastMsgDate = targetRoom.last_message?.createdAt
          ? new Date(targetRoom.last_message.createdAt).getTime()
          : 0;
        const newMsgDate = new Date(msgData.createdAt).getTime();

        // Update if newer or same time (sometimes useful)
        // Only update if it's not a duplicate event for same ID
        if (newMsgDate >= roomLastMsgDate) {
          // Handle unread count:
          // If I'm visible in the room (active room), unread = 0.
          // If not active room, and message is NOT mine, unread++
          // BUT: We don't want to increment if we just fetched history.
          // upsetMsg is called for history too?
          // Usually upsetMsg is for "sent" message (socket receive).
          // Fetch history uses `updateRoomDataWithGroups` but generally calls set directly in `fetchMessagesFromAPI`.
          // upsetMsg logic: `if (existingIndex === -1)`...

          // To be safe, only increment unread if it is a NEW message (existingIndex === -1)
          // AND it is NOT from history load (how to distinguish?).
          // Usually history load calls `fetchMessagesFromAPI` which does NOT call `upsetMsg`.
          // `upsetMsg` is likely used by Socket `on("message:receive")`.

          const isActiveRoom = roomStore.room?.id === normalizedRoomId;
          let newUnreadCount = targetRoom.unread_count;

          if (!isMine && !isActiveRoom && isNewMessage) {
            newUnreadCount = (targetRoom.unread_count || 0) + 1;
          }

          // If active room, reset unread?
          if (isActiveRoom) {
            newUnreadCount = 0;
          }

          const updatedRoom: roomType = {
            ...targetRoom,
            updatedAt: msgData.createdAt,
            unread_count: newUnreadCount,
            last_message: {
              id: msgData.id,
              content: snippet,
              createdAt: msgData.createdAt,
              sender: {
                id: msgData.sender.id || msgData.sender._id || "",
                name: msgData.sender.fullname || "",
                avatar: msgData.sender.avatar || "",
              },
              isMine: isMine,
            },
            is_read: isActiveRoom || isMine,
          };
          roomStore.updateRoomSocket(updatedRoom);
        }
      }
    } catch (e) {
      console.error("Error updating room store from message:", e);
    }

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
      groups: [],
      displayedMessagesCount: 20,
      reply: null,
    };

    const prevMessages = getAllMessagesFromGroups(prevRoom);

    const id = new ObjectId().toHexString();
    const foundReply = prevMessages.find((m) => m.id === replyTo);

    // Use raw foundReply without computing isMine
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
          // removed isMine, hiddenByMe
          isDeleted: false,
          hiddenAt: null,
        }
      : undefined;

    const data: MessageType = {
      id,
      roomId,
      content,
      attachments: attachments || [],
      reply,
      type: type || "text",
      documentId: args.documentId, // Add documentId
      createdAt: new Date().toISOString(),
      pinned: false,
      sender: {
        _id: userId || "",
        id: userId || "",
        fullname: userFullname || "Unknown",
        avatar: userAvatar || "",
      },
      // Removed isMine, isRead here as requested. Logic will handle it.
      status: attachments && attachments.length > 0 ? "uploading" : "pending",
      hiddenBy: [],
      hiddenAt: null,
      isDeleted: false,
      read_by: [],
    };

    // Thêm dữ liệu tạm
    const currentRoom = get().messagesRoom[roomId];
    const currentMessages = getAllMessagesFromGroups(currentRoom);
    const newMessages = [...currentMessages, data];

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          newMessages,
          currentRoom?.lastReadMessageId,
        ),
      },
    });

    // Update Room Store Optimistically (Sending)
    try {
      const roomStore = useRoomStore.getState();
      const targetRoom = roomStore.getRoomByRoomId(roomId);
      if (targetRoom) {
        let snippet = data.content || "";
        if (data.attachments && data.attachments.length > 0) {
          const firstAtt = data.attachments[0];
          const mime = firstAtt.mimeType || "";
          if (mime.startsWith("image") || firstAtt.kind === "image")
            snippet = i18n.t("chat.message.type.image") || "[Image]";
          else snippet = i18n.t("chat.message.type.file") || "[File]";
        }

        const updatedRoom: roomType = {
          ...targetRoom,
          updatedAt: data.createdAt,
          last_message: {
            id: data.id,
            content: snippet,
            createdAt: data.createdAt,
            sender: {
              id: data.sender.id,
              name: data.sender.fullname || "",
              avatar: data.sender.avatar || "",
            },
            isMine: true,
          },
          // No change to unread count for sent message
          // Ensure is_read is true since we are sending
          is_read: true,
          unread_count: 0, // Reset if we are sending (implies we read everything)
        };
        roomStore.updateRoomSocket(updatedRoom);
      }
    } catch (e) {
      console.error("Optimistic room update failed", e);
    }
    // Upload attachments nếu có (background task)
    if (attachments && attachments.length > 0) {
      get()
        .uploadAttachments({ roomId, messageId: id, attachments })
        .then((uploadedAttachments) => {
          // Only send attachments that were uploaded successfully.
          const successful = (uploadedAttachments || []).filter(
            (a) => a?.status === "uploaded",
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
              id,
            );
            // mark message as failed in UI
            const currentRoom = get().messagesRoom[roomId];
            const msgs = getAllMessagesFromGroups(currentRoom);
            const updatedMessages = msgs.map((msg) =>
              msg.id === id ? { ...msg, status: "failed" as const } : msg,
            );
            set({
              messagesRoom: {
                ...get().messagesRoom,
                [roomId]: updateRoomDataWithGroups(
                  currentRoom,
                  updatedMessages,
                  currentRoom?.lastReadMessageId,
                ),
              },
            });
          }
        })
        .catch((error) => {
          console.error("❌ Upload failed:", error);
          // Update message status to failed
          const currentRoom = get().messagesRoom[roomId];
          const msgs = getAllMessagesFromGroups(currentRoom);
          const updatedMessages = msgs.map((msg) =>
            msg.id === id ? { ...msg, status: "failed" as const } : msg,
          );
          set({
            messagesRoom: {
              ...get().messagesRoom,
              [roomId]: updateRoomDataWithGroups(
                currentRoom,
                updatedMessages,
                currentRoom?.lastReadMessageId,
              ),
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
        documentId: args.documentId, // Send documentId
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

      // Validate response structure
      if (!response?.data?.metadata || !Array.isArray(response.data.metadata)) {
        console.warn("⚠️ Invalid response structure from API:", response);
        set((state) => ({ ...state, isLoading: false }));
        return;
      }

      if (response.data.metadata.length === 0) {
        set((state) => ({ ...state, isLoading: false }));
        return;
      }

      // No need to compute fields
      const newMessages = response.data.metadata.map((msg: MessageType) => ({
        ...msg,
        roomId,
        status: (msg.status || "delivered") as MessageType["status"],
        attachments: sanitizeAttachmentsFromAPI(msg.attachments),
      }));

      // Lưu từng tin nhắn vào IndexedDB
      await Promise.all(
        newMessages.map((msg: MessageType) =>
          upsertOne(db.messages, sanitizeMessageForDB(msg)),
        ),
      );

      // Cập nhật state
      const currentRoom = get().messagesRoom[roomId] || {
        groups: [],
        displayedMessagesCount: 20,
        input: null,
        attachments: null,
        reply: null,
      };
      const currentMessages = getAllMessagesFromGroups(currentRoom);

      // Lọc ra những tin nhắn chưa có trong state
      const uniqueNewMessages = newMessages.filter(
        (newMsg: MessageType) =>
          !currentMessages.some((msg: MessageType) => msg.id === newMsg.id),
      );

      if (uniqueNewMessages.length > 0) {
        // Cập nhật messages trong room
        const updatedMsgs = [...currentMessages, ...uniqueNewMessages];
        set((state) => ({
          ...state,
          messagesRoom: {
            ...state.messagesRoom,
            [roomId]: updateRoomDataWithGroups(
              currentRoom,
              updatedMsgs,
              currentRoom?.lastReadMessageId,
            ),
          },
          isLoading: false,
        }));

        // Update Room Optimistically
        try {
          // Sort uniqueNewMessages by createdAt just to be sure
          const sortedNew = [...uniqueNewMessages].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          const latestMsg = sortedNew[sortedNew.length - 1];

          const roomStore = useRoomStore.getState();
          const targetRoom = roomStore.getRoomByRoomId(roomId);

          if (targetRoom && latestMsg) {
            const currentUser = useAuthStore.getState().user;
            const isMine = latestMsg.sender.id === currentUser?._id;
            let snippet = latestMsg.content || "";
            // Simplified check
            if (latestMsg.type === "image") {
              snippet = i18n.t("chat.message.type.image") || "[Image]";
            } else if (
              latestMsg.type === "file" ||
              latestMsg.type === "document"
            ) {
              snippet = i18n.t("chat.message.type.file") || "[File]";
            } else if (
              latestMsg.attachments &&
              latestMsg.attachments.length > 0
            ) {
              const firstAtt = latestMsg.attachments[0];
              if (
                firstAtt.mimeType?.startsWith("image") ||
                firstAtt.kind === "image"
              ) {
                snippet = i18n.t("chat.message.type.image") || "[Image]";
              } else {
                snippet = i18n.t("chat.message.type.file") || "[File]";
              }
            }

            const currentRoomTime = targetRoom.last_message?.createdAt
              ? new Date(targetRoom.last_message.createdAt).getTime()
              : 0;
            if (new Date(latestMsg.createdAt).getTime() >= currentRoomTime) {
              const updatedRoom: roomType = {
                ...targetRoom,
                updatedAt: latestMsg.createdAt,
                last_message: {
                  id: latestMsg.id,
                  content: snippet,
                  createdAt: latestMsg.createdAt,
                  sender: {
                    id: latestMsg.sender.id || latestMsg.sender._id || "",
                    name: latestMsg.sender.fullname || "",
                    avatar: latestMsg.sender.avatar || "",
                  },
                  isMine: isMine,
                },
              };
              // If active room, ensure read status
              if (roomStore.room?.id === roomId) {
                updatedRoom.unread_count = 0;
                updatedRoom.is_read = true;
              }
              roomStore.updateRoomSocket(updatedRoom);
            }
          }
        } catch (e) {
          console.error("Error updating room from fetchNewMessages", e);
        }
      } else {
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
    if (!currentRoom) return;

    // Retrieve all messages from groups to find the target
    const allMessages = getAllMessagesFromGroups(currentRoom);

    // Tìm message cần gửi lại
    const message = allMessages.find((msg) => msg.id === messageId);
    if (!message) {
      console.error("❌ Message not found:", messageId);
      return;
    }

    // Cập nhật status về pending
    const updatedMessages = allMessages.map((msg) =>
      msg.id === messageId ? { ...msg, status: "pending" as const } : msg,
    );

    set({
      messagesRoom: {
        ...state.messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          updatedMessages,
          currentRoom.lastReadMessageId,
          currentRoom.displayedMessagesCount,
        ),
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
          att.status === "failed" ? att : { ...att, file: undefined },
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
        const refreshedMsgs = getAllMessagesFromGroups(refreshedRoom);
        const refreshedMsg = refreshedMsgs.find((m) => m.id === messageId);
        finalAttachments = refreshedMsg?.attachments || allAttachments;
      }

      // Lấy các attachments đã upload thành công
      const successful = (finalAttachments || []).filter(
        (a) => a?.status === "uploaded",
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
      } else {
        console.warn(
          "⚠️ Some or all attachments failed to upload on resend — marking message failed",
          messageId,
        );

        const curRoom = get().messagesRoom[roomId];
        const curMsgs = getAllMessagesFromGroups(curRoom);
        const failedMessages = curMsgs.map((msg) =>
          msg.id === messageId ? { ...msg, status: "failed" as const } : msg,
        );

        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: updateRoomDataWithGroups(
              curRoom,
              failedMessages || [],
              curRoom?.lastReadMessageId,
            ),
          },
        });
      }
    } catch (error) {
      console.error("❌ Resend failed:", error);

      // Cập nhật lại status về failed
      const current = get().messagesRoom[roomId];
      const currentMsgs = getAllMessagesFromGroups(current);
      const failedMessages = currentMsgs.map((msg) =>
        msg.id === messageId ? { ...msg, status: "failed" as const } : msg,
      );

      set({
        messagesRoom: {
          ...get().messagesRoom,
          [roomId]: updateRoomDataWithGroups(
            current,
            failedMessages || [],
            current?.lastReadMessageId,
          ),
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
    },
  ): Promise<MessageType[]> => {
    try {
      // Validate roomId
      if (!roomId) {
        console.warn("⚠️ fetchMessagesFromAPI: roomId is required");
        return [];
      }

      // Gọi API lấy tin nhắn
      const response = (await MessageService.getMessages({
        roomId,
        queryParams: {
          limit: queryParams?.limit || 100,
        },
      })) as { data: { metadata: MessageType[] } };

      // Validate response structure
      if (!response?.data?.metadata || !Array.isArray(response.data.metadata)) {
        return [];
      }

      // Lấy current user ID
      const currentUser = useAuthStore.getState().user;
      const currentUserId = currentUser?._id;

      // Map và sanitize messages từ API
      const messages = response.data.metadata.map((msg: MessageType) => ({
        ...msg,
        roomId,
        status: (msg.status || "delivered") as MessageType["status"],
        attachments: sanitizeAttachmentsFromAPI(msg.attachments),
      }));

      // Upsert từng tin nhắn vào IndexedDB (đã được sanitize)
      await Promise.all(
        messages.map((msg: MessageType) =>
          upsertOne(db.messages, sanitizeMessageForDB(msg)),
        ),
      );

      // Lấy room hiện tại và merge messages
      const currentRoom = get().messagesRoom[roomId] || {
        groups: [],
        displayedMessagesCount: 20,
        input: null,
        attachments: null,
        reply: null,
      };
      const currentMessages = getAllMessagesFromGroups(currentRoom);

      // Merge messages: loại bỏ duplicate dựa trên ID
      const mergedMessages = [...currentMessages];
      for (const newMsg of messages) {
        const existingIndex = mergedMessages.findIndex(
          (m) => m.id === newMsg.id,
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
        a.id.localeCompare(b.id),
      );

      // Cập nhật state
      set({
        messagesRoom: {
          ...get().messagesRoom,
          [roomId]: updateRoomDataWithGroups(
            currentRoom,
            sortedMessages,
            currentRoom?.lastReadMessageId,
          ),
        },
      });

      return messages;
    } catch (error) {
      // Don't throw error, return empty array to prevent UI breaking
      // Error is expected in some cases (network issues, etc)
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
      a.id.localeCompare(b.id),
    );

    const prevRoom = get().messagesRoom[roomId] || {
      groups: [],
      displayedMessagesCount: 20,
      input: null,
      attachments: null,
      reply: null,
    };

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          prevRoom,
          sortedMessages,
          prevRoom?.lastReadMessageId,
        ),
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
    status?: string,
  ) => {
    const currentRoom = get().messagesRoom[roomId];
    if (!currentRoom) return;

    {
      /* Use helper to flatten groups */
    }
    const prevMessages = getAllMessagesFromGroups(currentRoom);

    // Tìm message và cập nhật attachment progress
    const updatedMessages = prevMessages.map((msg) => {
      if (msg.id !== messageId) return msg;

      const updatedAttachments = (msg.attachments || []).map((att) =>
        att._id === fileId
          ? {
              ...att,
              uploadProgress: progress,
              ...(status && { status }),
            }
          : att,
      );

      return {
        ...msg,
        attachments: updatedAttachments,
      };
    });

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          updatedMessages,
          currentRoom?.lastReadMessageId,
        ),
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
      return attachments;
    }

    // Đánh dấu tất cả là "uploading"
    for (const att of filesToUpload) {
      get().updateAttachmentProgress(
        roomId,
        messageId,
        att._id,
        0,
        "uploading",
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
            "uploading",
          );
        },
      })
        .then((resp) => {
          const data = resp.data;
          return {
            success: true as const,
            result: data,
            index,
            id: att._id,
          };
        })
        .catch((err: unknown) => {
          // Log chi tiết lỗi
          try {
            const error_ = err as unknown;
            const errorObj =
              error_ instanceof Error ? error_ : new Error(String(error_));
            console.error(
              `⚠️ Upload error for file index ${index} (id=${att._id}):`,
              {
                message: errorObj.message,
                stack: errorObj.stack,
              },
            );
          } catch {
            /* ignored */
          }

          // Mark failed
          get().updateAttachmentProgress(
            roomId,
            messageId,
            att._id,
            0,
            "failed",
          );

          // Quan trọng: luôn resolve, không throw -> Promise.all sẽ không reject
          return {
            success: false as const,
            error: err,
            index,
            id: att._id,
          };
        }),
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
        const errObj = res.error as Record<string, unknown>;
        const uploadError = {
          message: (errObj?.message as string | undefined) || String(errObj),
          responseData: (
            errObj?.response as Record<string, unknown> | undefined
          )?.data,
          responseStatus: (
            errObj?.response as Record<string, unknown> | undefined
          )?.status,
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
    const prevMessages = getAllMessagesFromGroups(currentRoom);
    const updatedMessages = prevMessages.map((msg) =>
      msg.id === messageId ? { ...msg, attachments: updatedAttachments } : msg,
    );

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          updatedMessages,
          currentRoom?.lastReadMessageId,
        ),
      },
    });

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
    limit: number = 100,
  ): Promise<any[]> => {
    const currentRoom = get().messagesRoom[roomId];
    const msgs = getAllMessagesFromGroups(currentRoom);
    if (!msgs || msgs.length === 0) {
      console.warn("No messages in local, skip loading older messages");
      return [];
    }

    // Lấy ID của tin nhắn cũ nhất hiện có
    const oldestMessage = msgs[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const oldestMessageId = oldestMessage?.id || (oldestMessage as any)?._id; // Fallback to _id if id is missing

    console.log("[DEBUG] loadOlderMessages", { roomId, limit, oldestMessage });

    if (!oldestMessageId) {
      console.warn("[DEBUG] No oldestMessageId found, cannot load older");
      return [];
    }

    // Set loading state (removed invalid isLoadingOlder update)
    // isLoadingOlder is managed by local component state
    try {
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
        // Get fresh state to avoid race conditions
        const freshRoom = get().messagesRoom[roomId];
        const freshMessages = getAllMessagesFromGroups(freshRoom);

        // Filter out duplicates that might already exist in freshMessages
        const uniqueOlderMessages = olderMessages.filter(
          (oldMsg: MessageType) =>
            !freshMessages.some((msg) => msg.id === oldMsg.id),
        );

        if (uniqueOlderMessages.length === 0) {
          return [];
        }

        // Prepend messages cũ vào đầu array
        const updatedMessages = [...uniqueOlderMessages, ...freshMessages];

        // Cập nhật state
        // Cập nhật state
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: updateRoomDataWithGroups(
              freshRoom,
              updatedMessages,
              freshRoom?.lastReadMessageId,
              (freshRoom?.displayedMessagesCount || 20) +
                uniqueOlderMessages.length,
            ),
          },
        });

        // Lưu vào IndexedDB
        for (const msg of uniqueOlderMessages) {
          await upsertOne(db.messages, sanitizeMessageForDB(msg));
        }

        return uniqueOlderMessages; // Return messages for caller to check
      } else {
        return []; // Return empty array if no messages
      }
    } catch (error) {
      console.error("❌ Error loading older messages:", error);
      throw error;
    }
  },

  /**
   * Find a message by ID in DB or API
   * Used for jumping to a specific message
   */
  findMessage: async (roomId: string, messageId: string): Promise<boolean> => {
    if (!messageId || messageId === "null" || messageId === "undefined") {
      console.warn("findMessage called with invalid ID:", messageId);
      return false;
    }
    try {
      // 1. Check IndexedDB
      const msgInDB = await db.messages.get(messageId);
      if (msgInDB && msgInDB.roomId === roomId) {
        // Found in DB, reload room messages to ensure consistency
        await get().getMessageByRoomId(roomId);
        return true;
      }

      // 2. Fetch from API
      // Try to fetch the specific message
      const result: any = await MessageService.getMessages({
        roomId,
        queryParams: {
          msgId: messageId,
          limit: 50, // Fetch context around the message
          type: "around", // Try to get context around the message
        },
      });

      const rawMessages = result.data.metadata;

      if (rawMessages && rawMessages.length > 0) {
        // Sanitize and save all fetched messages
        const sanitizedMessages = rawMessages.map((msg: MessageType) => ({
          ...msg,
          attachments: sanitizeAttachmentsFromAPI(msg.attachments),
        }));

        // Save to IndexedDB
        for (const msg of sanitizedMessages) {
          await upsertOne(db.messages, sanitizeMessageForDB(msg));
        }

        // Reload state from DB
        await get().getMessageByRoomId(roomId);

        // Check if our target message is in the fetched batch
        return sanitizedMessages.some((m: MessageType) => m.id === messageId);
      }

      return false;
    } catch (error: any) {
      console.error(
        "Error finding message:",
        error?.message || error,
        error?.response?.data,
      );
      return false;
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
        const msgs = getAllMessagesFromGroups(currentRoom);
        const updatedMessages = msgs.filter((msg) => msg.id !== messageId);
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: updateRoomDataWithGroups(
              currentRoom,
              updatedMessages,
              currentRoom?.lastReadMessageId,
            ),
          },
        });

        // Update IndexedDB
        await deleteOne(db.messages, messageId);
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
        const msgs = getAllMessagesFromGroups(currentRoom);
        const updatedMessages = msgs.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                status: "recalled" as MessageType["status"],
                content: "[Tin nhắn đã bị thu hồi]",
              }
            : msg,
        );

        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: updateRoomDataWithGroups(
              currentRoom,
              updatedMessages,
              currentRoom?.lastReadMessageId,
            ),
          },
        });

        // Update IndexedDB
        const msg = msgs.find((m) => m.id === messageId);
        if (msg) {
          await upsertOne(
            db.messages,
            sanitizeMessageForDB({
              ...msg,
              status: "recalled" as MessageType["status"],
              content: "[Tin nhắn đã bị thu hồi]",
            }),
          );
        }
      }
    } catch (error) {
      console.error("❌ Error recalling message:", error);
    }
  },

  setReplyMessage: (roomId: string, message: MessageType | null) => {
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

  setMessageSummary: async (
    roomId: string,
    messageId: string,
    summary: MessageSummary | null,
  ) => {
    const state = get();
    const currentRoom = state.messagesRoom[roomId];
    if (!currentRoom) return;

    const msgs = getAllMessagesFromGroups(currentRoom);
    const updatedMessages = msgs.map((msg) =>
      msg.id === messageId ? { ...msg, summary } : msg,
    );

    const updatedMessage = updatedMessages.find((m) => m.id === messageId);

    set({
      messagesRoom: {
        ...state.messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          updatedMessages,
          currentRoom?.lastReadMessageId,
        ),
      },
    });

    if (updatedMessage) {
      await upsertOne(db.messages, sanitizeMessageForDB(updatedMessage));
    }
  },

  setMessageTranslation: async (
    roomId: string,
    messageId: string,
    translation: MessageTranslation | null,
  ) => {
    const state = get();
    const currentRoom = state.messagesRoom[roomId];
    if (!currentRoom) return;

    const msgs = getAllMessagesFromGroups(currentRoom);
    const updatedMessages = msgs.map((msg) =>
      msg.id === messageId ? { ...msg, translation } : msg,
    );

    const updatedMessage = updatedMessages.find((m) => m.id === messageId);

    set({
      messagesRoom: {
        ...state.messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          updatedMessages,
          currentRoom?.lastReadMessageId,
        ),
      },
    });

    if (updatedMessage) {
      await upsertOne(db.messages, sanitizeMessageForDB(updatedMessage));
    }
  },
  upsetMsgError: (payload: {
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

    const prevMessages = getAllMessagesFromGroups(prevRoom);
    const existingIndex = prevMessages.findIndex((m) => m.id === id);

    // Nếu không tìm thấy message → không làm gì
    if (existingIndex === -1) {
      console.warn(
        "[upsetMsgError] message not found for id:",
        id,
        "room:",
        roomId,
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
      idx === existingIndex ? updatedMsg : m,
    );

    // update state
    set({
      messagesRoom: {
        ...state.messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          prevRoom,
          updatedMessages,
          prevRoom?.lastReadMessageId,
        ),
      },
    });

    // update IndexedDB
    try {
      upsertOne(db.messages, sanitizeMessageForDB(updatedMsg)).catch(
        (error) => {
          console.error("[upsetMsgError] IndexedDB upsert error:", error);
        },
      );
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

      const msgs = getAllMessagesFromGroups(currentRoom);
      const updatedMessages = msgs.map((msg) => {
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
          [roomId]: updateRoomDataWithGroups(
            currentRoom,
            updatedMessages,
            currentRoom?.lastReadMessageId,
          ),
        },
      });
    }, delayMs);
  },
  setDisplayedMessagesCount: (roomId: string, count: number) => {
    const currentRoom = get().messagesRoom[roomId];
    if (!currentRoom) return;

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          getAllMessagesFromGroups(currentRoom),
          currentRoom.lastReadMessageId,
          count,
        ),
      },
    });
  },
  setLastReadMessageId: (roomId: string, messageId: string | null) => {
    const currentRoom = get().messagesRoom[roomId];
    if (!currentRoom) return;

    set({
      messagesRoom: {
        ...get().messagesRoom,
        [roomId]: updateRoomDataWithGroups(
          currentRoom,
          getAllMessagesFromGroups(currentRoom),
          messageId,
        ),
      },
    });
  },
  clearRoomMessages: async (roomId: string) => {
    await db.messages.where("roomId").equals(roomId).delete();
    set((state) => {
      const nextMessages = { ...state.messagesRoom };
      delete nextMessages[roomId];
      return {
        ...state,
        messagesRoom: nextMessages,
      };
    });
  },
}));

export default useMessageStore;
