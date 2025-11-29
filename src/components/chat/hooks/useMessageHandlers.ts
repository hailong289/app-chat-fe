import { useCallback } from "react";
import { MessageType } from "@/store/types/message.state";
import useMessageStore from "@/store/useMessageStore";
import useToast from "@/hooks/useToast";
import { emitWithAck, canRecallMessage } from "../utils/messageHelpers";
import { socketEvent } from "@/types/socketEvent.type";

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
      messageState.upsetMsg(updated);

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
            messageState.upsetMsg(original);
            toast.error(ack?.reason || "Không thể xoá tin nhắn");
          } else {
            toast.success("Đã xoá tin nhắn");
          }
        })
        .catch((err) => {
          console.error("delete ack error", err);
          // rollback optimistic change
          messageState.upsetMsg(original);
          toast.error("Không thể kết nối tới máy chủ. Xoá không thành công.");
        });
    },
    [chatId, socket, emitWithAckHelper, messageState, toast]
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
          placeholder: "tin nhắn đã được thu hồi",
        },
        5000
      )
        .then((ack) => {
          console.debug("emit:message:recall ack:", ack, "msgId:", msg.id);
          if (!ack || ack?.ok === false) {
            // rollback
            messageState.upsetMsg(original);
            toast.error(ack?.reason || "Không thể thu hồi tin nhắn");
          } else {
            toast.success("Đã thu hồi tin nhắn");
          }
        })
        .catch((err) => {
          console.error("recall ack error", err);
          messageState.upsetMsg(original);
          toast.error(
            "Không thể kết nối tới máy chủ. Thu hồi không thành công."
          );
        });
    },
    [chatId, emitWithAckHelper, messageState, toast]
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
              toast.error(ack?.reason || "Không thể thay đổi trạng thái gim");
            } else {
              toast.success(
                !msg.pinned ? "Đã gim tin nhắn" : "Đã bỏ gim tin nhắn"
              );
            }
          })
          .catch((err) => {
            console.error("pin ack error", err);
            messageState.upsetMsg(original);
            toast.error(
              "Không thể kết nối tới máy chủ. Thao tác không thành công."
            );
          });
      } catch (err) {
        console.error("❌ Error toggling pin:", err);
      }
    },
    [chatId, emitWithAckHelper, messageState, toast]
  );

  return {
    handleReply,
    handleReact,
    handleCopy,
    handleDelete,
    handleRecall,
    handleTogglePin,
  };
}
