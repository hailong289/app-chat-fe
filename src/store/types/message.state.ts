import { SendMessageArgs } from "../useMessageStore";
import { CallMember } from "./call.state";

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
  size: number; // Support both local and server formats
  mimeType: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  duration?: number | null;
  status?: string; // "pending" | "uploading" | "uploaded" | "failed"
  uploadProgress?: number; // 0-100 (%)
  uploadedUrl?: string; // URL sau khi upload thành công
  file?: File; // File gốc để upload
  uploadError?: any; // optional structured error info when upload failed
};

export type MessageSummary = {
  text: string;
  title?: string;
  keyPoints?: string[];
  language?: string;
};

export type MessageTranslation = {
  text: string;
  from?: string;
  to: string;
};
export type MessageType = {
  id: string;
  roomId: string;
  type:
    | "text"
    | "image"
    | "file"
    | "system"
    | "video"
    | "audio"
    | "gif"
    | "document";
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinned: boolean;
  sender: MessageSender & { id?: string };
  attachments?: Array<FilePreview>;
  documentId?: string; // Link to Document collection
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
    isMine: boolean;
    hiddenByMe: boolean;
    isDeleted: boolean;
  };
  isMine: boolean;
  isRead: boolean;
  hiddenByMe: boolean;
  hiddenAt: string | null;
  read_by: Array<{
    readAt: string;
    user: {
      _id: string;
      id: string;
      fullname: string;
      avatar: string;
    };
  }>;
  isDeleted: boolean;
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
  call_history?: CallHistoryType | null;
  summary?: MessageSummary | null;
  translation?: MessageTranslation | null;
};

export interface CallHistoryType {
  _id: string;
  call_id: string;
  room_id: string;
  call_type: "audio" | "video";
  message_id: string;
  members: CallMember[];
  started_at: string;
  ended_at: string;
  duration: number;
  // Additional fields used in components
  caller_id?: string;
  callee_id?: string;
}
export interface GalleryItem {
  _id: string;
  msg_roomId: string;
  msg_content: string;
  msg_type: string;
  createdAt: string;
  attachments: FilePreview[];
}

export interface RoomGallery {
  media: GalleryItem[];
  docs: GalleryItem[];
  links: GalleryItem[];
  isLoadingMedia: boolean;
  isLoadingDocs: boolean;
  isLoadingLinks: boolean;
  hasMoreMedia: boolean;
  hasMoreDocs: boolean;
  hasMoreLinks: boolean;
}

export interface RoomData {
  messages: MessageType[];
  input: string | null;
  attachments: FilePreview[] | null;
  // ghim: string[] | null;
  // updatedAt: string | null;
  reply: MessageType | null;
  gallery?: RoomGallery;
}

export interface MessageState {
  isLoading: boolean;
  messagesRoom: Record<string, RoomData>; // roomId -> room data

  upsetMsg: (msgData: MessageType) => Promise<void>;
  sendMessage: (data: SendMessageArgs) => Promise<void>;
  resendMessage: (
    roomId: string,
    messageId: string,
    socket?: any
  ) => Promise<void>;
  getMessageByRoomId: (roomId: string) => Promise<void>;
  fetchMessagesFromAPI: (
    roomId: string,
    queryParams?: {
      msgId?: string;
      limit?: number;
      type?: "new" | "old" | "all";
    }
  ) => Promise<MessageType[]>;
  loadOlderMessages: (roomId: string, limit?: number) => Promise<any[]>;
  findMessage: (roomId: string, messageId: string) => Promise<boolean>;
  deleteMessage: (roomId: string, messageId: string) => Promise<void>;
  recallMessage: (roomId: string, messageId: string) => Promise<void>;
  fetchNewMessages: (roomId: string, lastMessageId?: string) => Promise<void>;
  clearRoomMessages: (roomId: string) => Promise<void>;

  uploadAttachments: (data: {
    roomId: string;
    messageId: string;
    attachments: FilePreview[];
  }) => Promise<FilePreview[]>;
  updateAttachmentProgress: (
    roomId: string,
    messageId: string,
    fileId: string,
    progress: number,
    status?: string
  ) => void;
  setReplyMessage: (roomId: string, message: MessageType | null) => void;
  setInput: (roomId: string, input: string | null) => void;
  setAttachments: (roomId: string, attachments: FilePreview[] | null) => void;
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
  }) => void;
  autoMarkMessageSent: (
    roomId: string,
    messageId: string,
    delayMs?: number
  ) => void;
  setMessageSummary: (
    roomId: string,
    messageId: string,
    summary: MessageSummary | null
  ) => Promise<void>;
  setMessageTranslation: (
    roomId: string,
    messageId: string,
    translation: MessageTranslation | null
  ) => Promise<void>;
}
export type msg = {
  input: string | null;
  attachments: Array<FilePreview> | null; // Đổi từ File sang FilePreview
  ghim: Array<string> | null;
  updatedAt: string | null;
  messages: Array<MessageType>;
  reply: MessageType | null;
  gallery?: RoomGallery;
};
