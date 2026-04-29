// TodoStatus is now a plain string to support project-defined custom statuses
export type TodoStatus = string;

export type TodoPriority = 'low' | 'medium' | 'high';

// ─── Project & Status ────────────────────────────────────────────────────────

export interface ProjectStatus {
  status_id: string;
  status_name: string;
  status_order: number;
  status_color?: string;
}

export interface TodoProject {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_statuses: ProjectStatus[];
  project_members: string[];
  project_createdBy: string;
  project_roomId?: string;
  is_default?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const isProjectCreator = (project: TodoProject, userId: string) =>
  project.project_createdBy === userId;

export const isProjectMember = (project: TodoProject, userId: string) =>
  project.project_members?.includes(userId) ?? false;

export interface CreateProjectPayload {
  project_name: string;
  project_description?: string;
  project_roomId?: string;
}

export interface UpdateProjectPayload {
  project_name?: string;
  project_description?: string;
}

export interface ProjectListParams {
  roomId?: string;
  page?: number;
  limit?: number;
}

export interface ProjectListData {
  data: TodoProject[];
  total_item: number | string;
  total_page: number | string;
  page: number | string;
}

export interface CreateProjectStatusPayload {
  status_name: string;
  status_color?: string;
}

export interface UpdateProjectStatusPayload {
  status_name?: string;
  status_color?: string;
  status_order?: number;
}

// ─── Todo ────────────────────────────────────────────────────────────────────

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
  todo_projectId?: string;
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
  todo_projectId?: string;
}

export interface UpdateTodoPayload {
  todo_title?: string;
  todo_description?: string;
  todo_status?: TodoStatus;
  todo_priority?: TodoPriority;
  todo_dueDate?: string;
  todo_projectId?: string;
}

export interface TodoListParams {
  userId: string;
  page: number;
  limit: number;
  status?: TodoStatus;
  roomId?: string;
  projectId?: string;
}

export interface TodoListData {
  data: TodoItem[];
  total_item: number | string;
  total_page: number | string;
  page: number | string;
}
