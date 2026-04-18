import apiService from "./api.service";
import {
  TodoItem,
  CreateTodoPayload,
  UpdateTodoPayload,
  TodoListParams,
  TodoListData,
  TodoStatus,
} from "@/types/todo.type";

interface APITodoResponse {
  message: string;
  statusCode: number;
  metadata: TodoItem;
}

interface APITodoListResponse {
  message: string;
  statusCode: number;
  metadata: TodoListData;
}

interface APIDeleteResponse {
  message: string;
  statusCode: number;
  metadata: string;
}

export const todoService = {
  /** POST /learning/todo/create */
  createTodo: async (
    payload: Omit<CreateTodoPayload, "todo_createdBy">
  ): Promise<TodoItem> => {
    const response = await apiService.post<APITodoResponse>(
      "/learning/todo/create",
      payload
    );
    return response.data?.metadata;
  },

  /** GET /learning/todo/get/:todo_id */
  getTodo: async (id: string): Promise<TodoItem> => {
    const response = await apiService.get<APITodoResponse>(
      `/learning/todo/get/${id}`
    );
    return response.data?.metadata;
  },

  /** GET /learning/todo/list — userId lấy từ auth token trên server */
  listTodos: async (
    params: Omit<TodoListParams, "userId">
  ): Promise<TodoListData> => {
    const response = await apiService.get<APITodoListResponse>(
      "/learning/todo/list",
      params
    );
    return response.data?.metadata;
  },

  /** PATCH /learning/todo/update/:todo_id */
  updateTodo: async (
    id: string,
    payload: UpdateTodoPayload
  ): Promise<TodoItem> => {
    const response = await apiService.patch<APITodoResponse>(
      `/learning/todo/update/${id}`,
      payload
    );
    return response.data?.metadata;
  },

  /** DELETE /learning/todo/delete/:todo_id */
  deleteTodo: async (id: string): Promise<string> => {
    const response = await apiService.delete<APIDeleteResponse>(
      `/learning/todo/delete/${id}`
    );
    return response.data?.metadata;
  },

  /** PATCH /learning/todo/:todo_id/assign */
  assignTodo: async (id: string, assigneeIds: string[]): Promise<TodoItem> => {
    const response = await apiService.patch<APITodoResponse>(
      `/learning/todo/${id}/assign`,
      { assignee_ids: assigneeIds }
    );
    return response.data?.metadata;
  },

  /** PATCH /learning/todo/:todo_id/status */
  updateTodoStatus: async (
    id: string,
    status: TodoStatus
  ): Promise<TodoItem> => {
    const response = await apiService.patch<APITodoResponse>(
      `/learning/todo/${id}/status`,
      { status }
    );
    return response.data?.metadata;
  },
};
