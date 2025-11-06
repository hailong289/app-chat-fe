import { SendMessageArgs } from "../useMessageStore";

export type MessageSender = {
  _id: string;
  fullname: string;
  avatar: string;
};
export type FilePreview = {
  _id: string;
  kind: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  duration?: number | null;
  status?: string;
};
export type MessageType = {
  id: string;
  roomId: string;
  type: "text" | "image" | "file" | "video";
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinned: boolean;
  sender: MessageSender & { id?: string };
  attachments?: Array<FilePreview>;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: Array<{
      _id: string;
      usr_id: string;
      usr_fullname: string;
      usr_avatar: string;
    }>;
  }>;
  reply?: {
    _id: string;
    type: string;
    content: string;
    createdAt: string;
    sender: {
      _id: string;
      name: string;
    };
  };
  isMine: boolean;
  isRead: boolean;
  hiddenByMe?: boolean;
  hiddenAt?: string | null;
  read_by?: Array<{
    readAt: string;
    user: {
      _id: string;
      id: string;
      fullname: string;
      avatar: string;
    };
  }>;
  read_by_count?: number;
  status?:
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "pending"
    | "uploading"
    | "uploaded";
};

export interface MessageState {
  isLoading: boolean;
  messagesRoom: Record<string, msg>; // roomId -> messages

  upsetMsg: (msgData: MessageType) => Promise<void>;
  sendMessage: (data: SendMessageArgs) => Promise<void>;
}
export type msg = {
  input: string | null;
  attachments: Array<File> | null;
  ghim: Array<string> | null;
  updatedAt: string | null;
  messages: Array<MessageType>;
  last_message_id: string | null;
  reply?: {
    _id: string;
    type: string;
    content: string;
  };
};
