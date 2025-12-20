import { MessageType } from "@/store/types/message.state";
import { RECALL_TIME_LIMIT_MINUTES } from "../components/chat/constants/messageConstants";

export const canRecallMessage = (msg: MessageType): boolean => {
  if (!msg.isMine) return false;
  const sentAt = new Date(msg.createdAt).getTime();
  const now = Date.now();
  const diffMs = now - sentAt;
  const diffMins = diffMs / (1000 * 60);
  return diffMins < RECALL_TIME_LIMIT_MINUTES;
};

export const emitWithAck = (
  socket: any,
  event: string,
  payload: any,
  timeout = 5000
): Promise<any> => {
  // This helper intentionally resolves with a standardized ack object
  // instead of rejecting the promise. This avoids unhandled promise
  // rejections in the UI and makes callers responsible for checking
  // ack.ok.
  return new Promise<any>((resolve) => {
    if (!socket) return resolve({ ok: false, error: "no-socket" });
    if (!socket.connected)
      return resolve({ ok: false, error: "socket-not-connected" });

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      // Resolve with a timeout-shaped ack instead of rejecting
      resolve({ ok: false, error: "ack-timeout" });
    }, timeout);

    try {
      socket.emit(event, payload, (ack: any) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // If server returns falsy ack, normalize it
        if (!ack) return resolve({ ok: false, error: "no-ack-or-falsy" });
        return resolve(ack);
      });
    } catch (err: any) {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, error: err?.message || String(err) });
      }
    }
  });
};
