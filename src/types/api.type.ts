export default interface ApiResponse<T> {
    message: string;
    statusCode: number;
    reasonStatusCode: string;
    metadata: T | null;
}