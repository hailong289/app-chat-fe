import { useCallback } from "react";
import { MessageType } from "@/store/types/message.state";
import useMessageStore from "@/store/useMessageStore";
import useToast from "@/hooks/useToast";
import { emitWithAck, canRecallMessage } from "../../../utils/messageHelpers";
import { socketEvent } from "@/types/socketEvent.type";
import { useTranslation } from "react-i18next";
import { aiService } from "@/service/ai.service";

interface UseMessageHandlersProps {
  chatId: string;
  socket: any;
  messageState: any;
  emitWithAckHelper: (
    event: string,
    payload: any,
    timeout?: number
  ) => Promise<any>;
}

export function useMessageHandlers({
  chatId,
  socket,
  messageState,
  emitWithAckHelper,
}: UseMessageHandlersProps) {
  const toast = useToast();
 const { t, i18n } = useTranslation();

  const handleReply = useCallback(
    (msg: MessageType) => {
      useMessageStore.getState().setReplyMessage(chatId, msg);
      // TODO: Scroll to input and focus
    },
    [chatId]
  );

  const handleReact = useCallback(
    (msg: MessageType, emoji: string) => {
      if (!socket || !socket.connected) return;

      socket.emit(
        socketEvent.MSGREACT,
        {
          roomId: chatId,
          msgId: msg.id,
          emoji: emoji,
        },
        () => {}
      );
    },
    [chatId, socket]
  );

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const handleDelete = useCallback(
    (msg: any) => {
      if (!socket || !socket.connected) return;

      const original = { ...msg };
      const updated = {
        ...msg,
        hiddenByMe: true,
        roomId: msg.roomId || chatId,
      };

      // Optimistic update
      useMessageStore.getState().upsetMsg(updated);

      // Emit and reconcile on ack/error
      emitWithAckHelper(
        socketEvent.MSGDELETE,
        { roomId: chatId, msgId: msg.id },
        5000
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
          // rollback optimistic change
          useMessageStore.getState().upsetMsg(original);
          toast.error(t("chat.hooks.delete.connectionError"));
        });
    },
    [chatId, socket, emitWithAckHelper, toast, t]
  );

  const handleRecall = useCallback(
    (msg: any) => {
      if (!canRecallMessage(msg)) return;
      if (!socket || !socket.connected) return;

      const original = { ...msg };

      // Optimistic local recall
      messageState.recallMessage(chatId, msg.id);
      const updated = {
        ...msg,
        isDeleted: true,
        roomId: msg.roomId || chatId,
      };
      messageState.upsetMsg(updated);

      emitWithAckHelper(
        socketEvent.MSGRECALL,
        {
          roomId: chatId,
          msgId: msg.id,
          placeholder: t("chat.hooks.recall.placeholder"),
        },
        5000
      )
        .then((ack) => {
          console.debug("emit:message:recall ack:", ack, "msgId:", msg.id);
          if (!ack || ack?.ok === false) {
            // rollback
            messageState.upsetMsg(original);
            toast.error(ack?.reason || t("chat.hooks.recall.error"));
          } else {
            toast.success(t("chat.hooks.recall.success"));
          }
        })
        .catch((err) => {
          console.error("recall ack error", err);
          messageState.upsetMsg(original);
          toast.error(t("chat.hooks.recall.connectionError"));
        });
    },
    [chatId, emitWithAckHelper, messageState, toast, t]
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
        messageState.upsetMsg(updated);

        emitWithAckHelper(
          socketEvent.MSGPINNED,
          {
            roomId: chatId,
            msgId: msg.id,
            pinned: !msg.pinned,
          },
          4000
        )
          .then((ack) => {
            console.debug("emit:message:pin ack:", ack, "msgId:", msg.id);
            if (!ack || ack?.ok === false) {
              messageState.upsetMsg(original);
              toast.error(ack?.reason || t("chat.hooks.pin.error"));
            } else {
              toast.success(
                !msg.pinned
                  ? t("chat.hooks.pin.pinned")
                  : t("chat.hooks.pin.unpinned")
              );
            }
          })
          .catch((err) => {
            console.error("pin ack error", err);
            messageState.upsetMsg(original);
            toast.error(t("chat.hooks.pin.connectionError"));
          });
      } catch (err) {
        console.error("❌ Error toggling pin:", err);
      }
    },
    [chatId, emitWithAckHelper, messageState, toast, t]
  );

  const handleTranslate = useCallback(
    async (msg: MessageType, targetLanguage?: string) => {
      if (!msg.content) return;

      const to = targetLanguage || i18n.language || "en";
      const from = "auto";

      try {
        useMessageStore
          .getState()
          .setMessageAiProcessing(chatId, msg.id, true, "translate");

        const result = await aiService.translate(msg.content, from, to);

        await useMessageStore
          .getState()
          .setMessageTranslation(chatId, msg.id, {
            text: result.translated,
            from: result.from,
            to: result.to,
          });

        toast.success(t("chat.hooks.translate.success", "Đã dịch tin nhắn"));
      } catch (error) {
        console.error("❌ translate error", error);
        toast.error(
          t("chat.hooks.translate.error", "Không thể dịch tin nhắn")
        );
      } finally {
        useMessageStore
          .getState()
          .setMessageAiProcessing(chatId, msg.id, false);
      }
    },
    [chatId, i18n.language, t, toast]
  );

  const handleSummarize = useCallback(
    async (msg: MessageType) => {
      try {
        useMessageStore
          .getState()
          .setMessageAiProcessing(chatId, msg.id, true, "summary");

        const attachment = (msg.attachments || []).find(
          (att) => att.uploadedUrl || att.url
        );
     
        if (!attachment ) {
          toast.error(
            t("chat.hooks.summary.noFile", "Không tìm thấy tệp để tóm tắt")
          );
          return;
        }
        const fileUrl = attachment.uploadedUrl || attachment.url;
        const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(fileUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error("Failed to download file for summary");
        }

        const blob = await response.blob();
        const fileName = attachment.name || `document-${msg.id}`;
        const fileType = attachment.mimeType || blob.type || "application/octet-stream";
        const file = new File([blob], fileName, { type: fileType });
        console.log("🚀 ~ useMessageHandlers ~ file:", file)

     const  result = await aiService.summaryDocument(file);


        await useMessageStore
          .getState()
          .setMessageSummary(chatId, msg.id, {
            text: result.summary,
            title: result.title,
            keyPoints: result.keyPoints,
            language: result.language,
          });

        toast.success(t("chat.hooks.summary.success", "Đã tóm tắt tài liệu"));
      } catch (error) {
        console.error("❌ summary error", error);
        toast.error(
          t("chat.hooks.summary.error", "Không thể tóm tắt tài liệu")
        );
      } finally {
        useMessageStore
          .getState()
          .setMessageAiProcessing(chatId, msg.id, false);
      }
    },
    [chatId, t, toast]
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
