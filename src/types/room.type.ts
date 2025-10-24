export interface QueryRooms {
  q?: string;
  type?: "group" | "private" | "channel" | "all";
  limit?: number;
  offset?: number;
}
