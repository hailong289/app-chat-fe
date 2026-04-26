export interface ContactType {
  _id: string;
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
  /**
   * True if this user appears as a member in one of the current user's
   * private/group rooms (i.e. someone they've actually messaged with).
   * Used to prioritize chat partners over plain search results in the
   * "đang hoạt động" list. Friends without an active chat have this
   * implicitly true via friendship: ACCEPTED, but the field stays
   * decoupled so the sort logic doesn't conflate the two concepts.
   */
  chatPartner?: boolean;
}

/**
 * People-You-May-Know entry returned by `GET /social/users/suggestions`.
 * Distinct from `ContactType` because suggestions don't carry the full
 * relationship data (no friendship, no chat history, no presence yet).
 */
export interface FriendSuggestionType {
  _id: string;
  id: string; // usr_id (ULID)
  fullname: string;
  avatar: string;
  email: string;
  mutualFriendsCount: number;
  /** Up to 3 mutual-friend names — for "5 friends including X, Y, Z". */
  mutualSamples: string[];
}

export interface ContactState {
  isLoading: boolean;
  contacts: ContactType[];
  error: string | null;
  contact: ContactType | null;
  searchResults: ContactType[];
  online: ContactType[];
  /**
   * Set of userIds (Users.usr_id) whose presence is currently online.
   * Updated by every `STATUS` and `status:online:bulk` socket event,
   * regardless of whether the user is in the `contacts` list. Use this
   * (NOT `contact.isOnline`) to drive online dots on the conversation
   * list — many private chats are with people we never explicitly
   * added as a friend, so `contacts` may not have an entry for them.
   */
  onlineUserIds: Set<string>;
  eligibleContacts: any[];
  inviteds: ContactType[];
  sent: ContactType[];
  friends: ContactType[];
  /** People-You-May-Know list (mutual-friends ranked). */
  suggestions: FriendSuggestionType[];
  page: number;
  limit: number;
  search: (search: string) => Promise<void>;
  setContact: (id: string) => Promise<void>;
  getAllContacts: () => Promise<ContactType[]>;
  /**
   * Fetch People-You-May-Know suggestions from
   * `GET /social/users/suggestions` and stash them in `suggestions`.
   * Returns the same array for convenience. Errors are swallowed (the
   * suggestion strip is non-critical UI — failing should not block
   * other features).
   */
  fetchFriendSuggestions: (limit?: number) => Promise<FriendSuggestionType[]>;
  syncEligibleContacts: () => void;
  /**
   * Persist every member of the current user's rooms into `db.contacts` so
   * their online status can be tracked + rendered in the "online list",
   * even if they were never explicitly added as a friend. Marks them with
   * `chatPartner: true` so the UI can prioritize them over pure search
   * results. Idempotent — safe to call after every rooms refresh.
   */
  syncChatPartners: () => Promise<void>;
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
  /**
   * Defensive O(1) presence check. Use this instead of reading
   * `onlineUserIds.has(...)` directly — the Set can rehydrate from
   * legacy localStorage as a plain object, which breaks `.has`.
   */
  isUserOnline: (userId: string) => boolean;
  socketHandleOnline: (data: {
    id: string;
    isOnline: boolean;
    onlineAt: string | null;
  }) => void;
  /** Bulk variant of socketHandleOnline — applies a `status:online:bulk` payload. */
  socketHandleOnlineBulk: (
    users: Array<{
      id: string;
      isOnline: boolean;
      onlineAt?: string | null;
    }>,
  ) => void;
  checkOnlineStatus: (socket: any) => void;
  BlockUser: (requestId: string) => Promise<void>;
  UnlockBlockedUser: (requestId: string) => Promise<void>;
}
