export interface QueryRooms {
  q?: string;
  type?: "group" | "private" | "channel";
  limit?: number;
  offset?: number;
}
