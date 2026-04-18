export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoItem {
  todo_id: string;
  todo_title: string;
  todo_description: string;
  todo_status: TodoStatus;
  todo_priority: TodoPriority;
  todo_dueDate: string;
  todo_roomId: string;
  todo_createdBy: string;
  todo_assignees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoPayload {
  todo_title: string;
  todo_createdBy: string;
  todo_description?: string;
  todo_status?: TodoStatus;
  todo_priority?: TodoPriority;
  todo_dueDate?: string;
  todo_roomId?: string;
  todo_assignees?: string[];
}

export interface UpdateTodoPayload {
  todo_title?: string;
  todo_description?: string;
  todo_status?: TodoStatus;
  todo_priority?: TodoPriority;
  todo_dueDate?: string;
}

export interface TodoListParams {
  userId: string;
  page: number;
  limit: number;
  status?: TodoStatus;
  roomId?: string;
}

export interface TodoListData {
  data: TodoItem[];
  total_item: number | string;
  total_page: number | string;
  page: number | string;
}
