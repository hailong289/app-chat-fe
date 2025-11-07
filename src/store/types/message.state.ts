import { SendMessageArgs } from "../useMessageStore";

export type MessageSender = {
  _id: string;
  fullname: string;
  avatar: string;
};
export type FilePreview = {
  _id: string;
  kind: string;
  url: string; // Local blob URL hoặc remote URL sau upload
  name: string;
  size: number;
  mimeType: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  duration?: number | null;
  status?: string; // "pending" | "uploading" | "uploaded" | "failed"
  uploadProgress?: number; // 0-100 (%)
  uploadedUrl?: string; // URL sau khi upload thành công
  file?: File; // File gốc để upload
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
    | "uploaded"
    | "recalled";
};

export interface RoomData {
  messages: MessageType[];
  input: string | null;
  attachments: FilePreview[] | null;
  ghim: string[] | null;
  updatedAt: string | null;
}

export interface MessageState {
  isLoading: boolean;
  messagesRoom: Record<string, RoomData>; // roomId -> room data
  readedRooms: Record<string, string>; // roomId -> lastMessageId

  upsetMsg: (msgData: MessageType) => Promise<void>;
  sendMessage: (data: SendMessageArgs) => Promise<void>;
  resendMessage: (
    roomId: string,
    messageId: string,
    socket?: any
  ) => Promise<void>;
  getMessageByRoomId: (roomId: string) => Promise<void>;
  loadOlderMessages: (roomId: string, limit?: number) => Promise<any[]>;
  deleteMessage: (roomId: string, messageId: string) => Promise<void>;
  recallMessage: (roomId: string, messageId: string) => Promise<void>;
  fetchNewMessages: (roomId: string, lastMessageId?: string) => Promise<void>;

  uploadAttachments: (
    roomId: string,
    messageId: string,
    attachments: FilePreview[]
  ) => Promise<FilePreview[]>;
  updateAttachmentProgress: (
    roomId: string,
    messageId: string,
    fileId: string,
    progress: number,
    status?: string
  ) => void;
}
export type msg = {
  input: string | null;
  attachments: Array<FilePreview> | null; // Đổi từ File sang FilePreview
  ghim: Array<string> | null;
  updatedAt: string | null;
  messages: Array<MessageType>;
  reply?: {
    _id: string;
    type: string;
    content: string;
  };
};
