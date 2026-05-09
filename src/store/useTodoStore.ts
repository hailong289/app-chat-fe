import { create } from "zustand";
import { TodoItem, TodoProject, TodoListParams } from "@/types/todo.type";
import { todoService } from "@/service/todo.service";

interface TodoStoreState {
  todos: TodoItem[];
  projects: TodoProject[];
  selectedProjectId: string | null;
  isLoadingTodos: boolean;
  isLoadingProjects: boolean;

  // Data fetching
  fetchTodos: (params?: Partial<Omit<TodoListParams, "userId">>) => Promise<void>;
  fetchProjects: (roomId?: string) => Promise<void>;

  // Selection
  setSelectedProjectId: (id: string | null) => void;
  getSelectedProject: () => TodoProject | null;

  // Optimistic / local mutations
  upsertTodo: (todo: TodoItem) => void;
  removeTodo: (id: string) => void;
  upsertProject: (project: TodoProject) => void;
  removeProject: (id: string) => void;
}

const useTodoStore = create<TodoStoreState>((set, get) => ({
  todos: [],
  projects: [],
  selectedProjectId: null,
  isLoadingTodos: false,
  isLoadingProjects: false,

  fetchTodos: async (params) => {
    set({ isLoadingTodos: true });
    try {
      const result = await todoService.listTodos({
        page: 1,
        limit: 200,
        ...params,
      });
      set({ todos: result?.data ?? [] });
    } finally {
      set({ isLoadingTodos: false });
    }
  },

  fetchProjects: async (roomId) => {
    set({ isLoadingProjects: true });
    try {
      const result = await todoService.listProjects(
        roomId ? { roomId } : undefined
      );
      const projects = result?.data ?? [];
      set({ projects });
      // Auto-select first project if nothing is selected yet
      const current = get().selectedProjectId;
      if (!current && projects.length > 0) {
        set({ selectedProjectId: projects[0].project_id });
      }
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  getSelectedProject: () => {
    const { projects, selectedProjectId } = get();
    if (!selectedProjectId) return null;
    return projects.find((p) => p.project_id === selectedProjectId) ?? null;
  },

  upsertTodo: (todo) =>
    set((state) => {
      const exists = state.todos.some((t) => t.todo_id === todo.todo_id);
      return {
        todos: exists
          ? state.todos.map((t) => (t.todo_id === todo.todo_id ? todo : t))
          : [todo, ...state.todos],
      };
    }),

  removeTodo: (id) =>
    set((state) => ({ todos: state.todos.filter((t) => t.todo_id !== id) })),

  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.some(
        (p) => p.project_id === project.project_id
      );
      return {
        projects: exists
          ? state.projects.map((p) =>
              p.project_id === project.project_id ? project : p
            )
          : [...state.projects, project],
      };
    }),

  removeProject: (id) =>
    set((state) => {
      const next = state.projects.filter((p) => p.project_id !== id);
      // If deleted project was selected, pick next available or null
      const newSelected =
        state.selectedProjectId === id
          ? (next[0]?.project_id ?? null)
          : state.selectedProjectId;
      return { projects: next, selectedProjectId: newSelected };
    }),
}));

export default useTodoStore;
