export interface ContactType {
  id: string;
  fullname: string;
  avatar: string | null;
  email: string;
  phone: string | null;
  updatedAt: string;
  createdAt: string;
  gender: string | null;
  status: string;
  dateOfBirth: string | null;
  friendship: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | "INVALID";
  actionUserId: string | null;
  isOnline: boolean;
  onlineAt: string | null;
}

export interface ContactState {
  isLoading: boolean;
  contacts: ContactType[];
  error: string | null;
  contact: ContactType | null;
  searchResults: ContactType[];
  online: ContactType[];
  inviteds: ContactType[];
  sent: ContactType[];
  friends: ContactType[];
  page: number;
  limit: number;
  search: (search: string) => Promise<void>;
  setContact: (id: string) => Promise<void>;
  getAllContacts: () => Promise<ContactType[]>;
  sendInvitation: ({
    userId,
    receiverId,
  }: {
    userId: string;
    receiverId: string;
  }) => Promise<void>;
  friendRequessts: (payload: {
    page?: number;
    limit?: number;
    type?: "sent" | "received";
  }) => Promise<{ total: number; page: number; limit: number }>;
  acceptInvitation: (requestId: string) => Promise<void>;
  rejectInvitation: (requestId: string) => Promise<void>;
  getFriends: () => Promise<ContactType[]>;
  socketHandleOnline: (data: {
    id: string;
    isOnline: boolean;
    onlineAt: string | null;
  }) => void;
}
