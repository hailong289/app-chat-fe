import { useCallback } from "react";
import { MessageType } from "@/store/types/message.state";
import useMessageStore from "@/store/useMessageStore";
import useToast from "@/hooks/useToast";
import { emitWithAck, canRecallMessage } from "../../../utils/messageHelpers";
import { socketEvent } from "@/types/socketEvent.type";
import { useTranslation } from "react-i18next";
import { aiService } from "@/service/ai.service";
import useAuthStore from "@/store/useAuthStore";

interface UseMessageHandlersProps {
  chatId: string;
  socket: any;
  messageState: any;
  emitWithAckHelper: (
    event: string,
    payload: any,
    timeout?: number,
  ) => Promise<any>;
}

export function useMessageHandlers({
  chatId,
  socket,
  emitWithAckHelper,
}: Omit<UseMessageHandlersProps, "messageState">) {
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const handleReply = useCallback(
    (msg: MessageType) => {
      useMessageStore.getState().setReplyMessage(chatId, msg);
      // TODO: Scroll to input and focus
    },
    [chatId],
  );

  const handleReact = useCallback(
    (msg: MessageType, emoji: string) => {
      if (!socket || !socket.connected) return;
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      const original = { ...msg }; // Shallow copy is ok for rollback if we don't mutate deep
      // Deep clone for updates to avoid mutating state directly before setting
      const updated = JSON.parse(JSON.stringify(msg));

      updated.reactions = updated.reactions || [];

      // Check if user already reacted with this emoji
      const existingReactionIndex = updated.reactions.findIndex(
        (r: any) => r.emoji === emoji,
      );

      let action = "add";

      if (existingReactionIndex > -1) {
        // Emoji exists
        const reaction = updated.reactions[existingReactionIndex];
        const userIndex = reaction.users.findIndex(
          (u: any) => u.id === currentUser.id,
        );

        if (userIndex > -1) {
          // User already reacted -> remove
          reaction.count--;
          reaction.users.splice(userIndex, 1);
          if (reaction.count <= 0) {
            updated.reactions.splice(existingReactionIndex, 1);
          }
          action = "remove";
        } else {
          // User distinct -> add
          reaction.count++;
          reaction.users.push({
            id: currentUser.id,
            name: currentUser.fullname,
            avatar: currentUser.avatar,
          });
        }
      } else {
        // New emoji
        updated.reactions.push({
          emoji,
          count: 1,
          users: [
            {
              id: currentUser.id,
              name: currentUser.fullname,
              avatar: currentUser.avatar,
            },
          ],
        });
      }

      // Optimistic update
      useMessageStore.getState().upsetMsg(updated);

      emitWithAckHelper(
        socketEvent.MSGREACT,
        {
          roomId: chatId,
          msgId: msg.id,
          emoji,
          action,
        },
        2000,
      )
        .then((ack) => {
          console.debug("emit:message:react ack:", ack);
          if (!ack || ack?.ok === false) {
            // rollback
            useMessageStore.getState().upsetMsg(original);
            toast.error(ack?.reason || t("chat.hooks.react.error"));
          }
        })
        .catch((err) => {
          console.error("react ack error", err);
          // rollback
          useMessageStore.getState().upsetMsg(original);
          toast.error(t("chat.hooks.react.connectionError"));
        });
    },
    [chatId, socket, emitWithAckHelper, toast, t],
  );

  const handleCopy = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content);
      toast.success(t("chat.hooks.copy.success"));
    },
    [t, toast],
  );

  const handleDelete = useCallback(
    (msg: MessageType) => {
      if (!socket || !socket.connected) return;

      const original = { ...msg };
      // Optimistic update
      // We can mark as deleted or remove from store
      // Here marking as deleted
      const updated = {
        ...msg,
        isDeleted: true,
        // Ensure roomId
        roomId: msg.roomId || chatId,
      };
      useMessageStore.getState().upsetMsg(updated);

      emitWithAckHelper(
        socketEvent.MSGDELETE,
        {
          roomId: chatId,
          msgId: msg.id,
        },
        5000,
      )
        .then((ack) => {
          console.debug("emit:message:delete ack:", ack, "msgId:", msg.id);
          if (!ack || ack?.ok === false) {
            // rollback
            useMessageStore.getState().upsetMsg(original);
            toast.error(ack?.reason || t("chat.hooks.delete.error"));
          } else {
            toast.success(t("chat.hooks.delete.success"));
          }
        })
        .catch((err) => {
          console.error("delete ack error", err);
          useMessageStore.getState().upsetMsg(original);
          toast.error(t("chat.hooks.delete.connectionError"));
        });
    },
    [chatId, socket, emitWithAckHelper, toast, t],
  );

  const handleRecall = useCallback(
    (msg: MessageType) => {
      // Re-check recall permission just in case
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      const isMine = msg.sender ? msg.sender.id === currentUser.id : false;
      if (!canRecallMessage(msg, isMine)) return;
      if (!socket || !socket.connected) return;

      const original = { ...msg };

      // Optimistic local recall
      useMessageStore.getState().recallMessage(chatId, msg.id);
      const updated = {
        ...msg,
        isDeleted: true,
        roomId: msg.roomId || chatId,
      };
      useMessageStore.getState().upsetMsg(updated);

      emitWithAckHelper(
        socketEvent.MSGRECALL,
        {
          roomId: chatId,
          msgId: msg.id,
          placeholder: t("chat.hooks.recall.placeholder"),
        },
        5000,
      )
        .then((ack) => {
          console.debug("emit:message:recall ack:", ack, "msgId:", msg.id);
          if (!ack || ack?.ok === false) {
            // rollback
            useMessageStore.getState().upsetMsg(original);
            toast.error(ack?.reason || t("chat.hooks.recall.error"));
          } else {
            toast.success(t("chat.hooks.recall.success"));
          }
        })
        .catch((err) => {
          console.error("recall ack error", err);
          useMessageStore.getState().upsetMsg(original);
          toast.error(t("chat.hooks.recall.connectionError"));
        });
    },
    [chatId, socket, emitWithAckHelper, toast, t],
  );

  const handleTogglePin = useCallback(
    (msg: any) => {
      try {
        if (!socket || !socket.connected) return;

        const original = { ...msg };
        const updated = {
          ...msg,
          pinned: !msg.pinned,
          roomId: msg.roomId || chatId,
        };

        // Optimistic
        useMessageStore.getState().upsetMsg(updated);

        emitWithAckHelper(
          socketEvent.MSGPINNED,
          {
            roomId: chatId,
            msgId: msg.id,
            pinned: !msg.pinned,
          },
          4000,
        )
          .then((ack) => {
            console.debug("emit:message:pin ack:", ack, "msgId:", msg.id);
            if (!ack || ack?.ok === false) {
              useMessageStore.getState().upsetMsg(original);
              toast.error(ack?.reason || t("chat.hooks.pin.error"));
            } else {
              toast.success(
                !msg.pinned
                  ? t("chat.hooks.pin.pinned")
                  : t("chat.hooks.pin.unpinned"),
              );
            }
          })
          .catch((err) => {
            console.error("pin ack error", err);
            useMessageStore.getState().upsetMsg(original);
            toast.error(t("chat.hooks.pin.connectionError"));
          });
      } catch (err) {
        console.error("❌ Error toggling pin:", err);
      }
    },
    [chatId, socket, emitWithAckHelper, toast, t],
  );

  const handleTranslate = useCallback(
    async (msg: MessageType, targetLanguage?: string) => {
      if (!msg.content) return;

      const to = targetLanguage || i18n.language || "en";
      const from = "auto";

      try {
        const result = await aiService.translate(msg.content, from, to);

        await useMessageStore.getState().setMessageTranslation(chatId, msg.id, {
          text: result.translated,
          from: result.from,
          to: result.to,
        });

        toast.success(t("chat.hooks.translate.success", "Đã dịch tin nhắn"));
      } catch (error) {
        console.error("❌ translate error", error);
        toast.error(t("chat.hooks.translate.error", "Không thể dịch tin nhắn"));
      }
    },
    [chatId, i18n.language, t, toast],
  );

  const handleSummarize = useCallback(
    async (msg: MessageType) => {
      try {
        const attachment = (msg.attachments || []).find(
          (att) => att.uploadedUrl || att.url,
        );
        let result;
        if (!attachment) {
          toast.error(
            t("chat.hooks.summary.noFile", "Không tìm thấy tệp để tóm tắt"),
          );
          return;
        } else {
          const fileUrl = attachment.uploadedUrl || attachment.url;
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error("Failed to download file for summary");
          }

          const blob = await response.blob();
          const fileName = attachment.name || `document-${msg.id}`;
          const fileType =
            attachment.mimeType || blob.type || "application/octet-stream";
          const file = new File([blob], fileName, { type: fileType });

          result = await aiService.summaryDocument(file);
        }

        await useMessageStore.getState().setMessageSummary(chatId, msg.id, {
          text: result.summary,
          title: result.title,
          keyPoints: result.keyPoints,
          language: result.language,
        });

        toast.success(t("chat.hooks.summary.success", "Đã tóm tắt tài liệu"));
      } catch (error) {
        console.error("❌ summary error", error);
        toast.error(
          t("chat.hooks.summary.error", "Không thể tóm tắt tài liệu"),
        );
      }
    },
    [chatId, t, toast],
  );

  return {
    handleReply,
    handleReact,
    handleCopy,
    handleDelete,
    handleRecall,
    handleTogglePin,
    handleTranslate,
    handleSummarize,
  };
}
