export interface ContactType {
  id: string;
  fullname: string;
  avatar: string | null;
  email: string;
  phone: string | null;
  updatedAt: string;
  createdAt: string;
  gender: string | null;
  status?: string;
  dateOfBirth: string | null;
  friendship?: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | "INVALID";
  actionUserId?: string | null;
}

export interface ContactState {
  isLoading: boolean;
  contacts: ContactType[];
  error: string | null;
  contact: ContactType | null;
  searchResults: ContactType[];
  page: number;
  limit: number;
  search: (search: string) => Promise<void>;
  setContact: (id: string) => Promise<void>;
  getAllContacts: () => Promise<ContactType[]>;
}
