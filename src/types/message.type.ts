
export interface GetMessageType {
    roomId: string;
    queryParams?: {
        limit?: number;
        type?:string;
        msgId?: string;
    }
}