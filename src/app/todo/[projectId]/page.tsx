"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  CardBody,
  Chip,
  useDisclosure,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ScrollShadow,
  Avatar,
  Checkbox,
} from "@heroui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  CalendarDaysIcon,
  FlagIcon,
  UserPlusIcon,
  ArrowLeftIcon,
  SwatchIcon,
  UsersIcon,
  ArrowRightStartOnRectangleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { format, isPast, parseISO, isValid } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import useAuthStore from "@/store/useAuthStore";
import useContactStore from "@/store/useContactStore";
import useTodoStore from "@/store/useTodoStore";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import { useSocket } from "@/components/providers/SocketProvider";
import { roomType } from "@/store/types/room.state";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { todoService } from "@/service/todo.service";
import { toast } from "@/store/useToastStore";
import {
  TodoItem,
  TodoPriority,
  CreateTodoPayload,
  UpdateTodoPayload,
  ProjectStatus,
  TodoProject,
  CreateProjectStatusPayload,
  isProjectCreator,
} from "@/types/todo.type";
import { ContactType } from "@/store/types/contact.type";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR_OPTIONS = [
  { value: "gray",   label: "Xám",        class: "bg-gray-400" },
  { value: "blue",   label: "Xanh dương", class: "bg-blue-500" },
  { value: "green",  label: "Xanh lá",    class: "bg-green-500" },
  { value: "yellow", label: "Vàng",       class: "bg-yellow-500" },
  { value: "red",    label: "Đỏ",         class: "bg-red-500" },
  { value: "purple", label: "Tím",        class: "bg-purple-500" },
  { value: "pink",   label: "Hồng",       class: "bg-pink-500" },
  { value: "orange", label: "Cam",        class: "bg-orange-500" },
];

function getColorClassKanban(color?: string) {
  return STATUS_COLOR_OPTIONS.find((c) => c.value === color)?.class ?? "bg-gray-400";
}

const PRIORITY_COLORS: Record<TodoPriority, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

type PaletteEntry = {
  chip: "default" | "primary" | "success" | "warning" | "danger" | "secondary";
  bgClass: string;
  headerClass: string;
  dropActiveClass: string;
};

const STATUS_COLOR_PALETTE: Record<string, PaletteEntry> = {
  gray: {
    chip: "default",
    bgClass: "bg-gray-50 dark:bg-gray-900",
    headerClass: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
    dropActiveClass: "ring-2 ring-gray-400 bg-gray-100 dark:bg-gray-800",
  },
  blue: {
    chip: "primary",
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
    headerClass: "bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200",
    dropActiveClass: "ring-2 ring-blue-400 bg-blue-100 dark:bg-blue-900/40",
  },
  green: {
    chip: "success",
    bgClass: "bg-green-50 dark:bg-green-950/20",
    headerClass: "bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200",
    dropActiveClass: "ring-2 ring-green-400 bg-green-100 dark:bg-green-900/40",
  },
  yellow: {
    chip: "warning",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20",
    headerClass: "bg-yellow-200 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200",
    dropActiveClass: "ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900/40",
  },
  red: {
    chip: "danger",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    headerClass: "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200",
    dropActiveClass: "ring-2 ring-red-400 bg-red-100 dark:bg-red-900/40",
  },
  purple: {
    chip: "secondary",
    bgClass: "bg-purple-50 dark:bg-purple-950/20",
    headerClass: "bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200",
    dropActiveClass: "ring-2 ring-purple-400 bg-purple-100 dark:bg-purple-900/40",
  },
  pink: {
    chip: "secondary",
    bgClass: "bg-pink-50 dark:bg-pink-950/20",
    headerClass: "bg-pink-200 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200",
    dropActiveClass: "ring-2 ring-pink-400 bg-pink-100 dark:bg-pink-900/40",
  },
  orange: {
    chip: "warning",
    bgClass: "bg-orange-50 dark:bg-orange-950/20",
    headerClass: "bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200",
    dropActiveClass: "ring-2 ring-orange-400 bg-orange-100 dark:bg-orange-900/40",
  },
};

function getStatusPaletteByColor(color?: string): PaletteEntry {
  return STATUS_COLOR_PALETTE[color ?? "gray"] ?? STATUS_COLOR_PALETTE.gray;
}

const makeDefaultForm = (projectId: string, statusId?: string) => ({
  todo_title: "",
  todo_createdBy: "",
  todo_description: "",
  todo_status: statusId ?? "",
  todo_priority: "medium" as TodoPriority,
  todo_dueDate: "",
  todo_projectId: projectId,
  todo_id: undefined as string | undefined,
});

type FormState = ReturnType<typeof makeDefaultForm>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const currentUserId = useAuthStore((s) => s.user?._id ?? s.user?.id ?? "");
  const currentUser = useAuthStore((s) => s.user);
  const getFriends = useContactStore((s) => s.getFriends);
  const storeFriends = useContactStore((s) => s.friends);
  const rooms = useRoomStore((s) => s.rooms);
  const getRooms = useRoomStore((s) => s.getRooms);
  const getRoomsByType = useRoomStore((s) => s.getRoomsByType);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const { socket, connect } = useSocket("/chat");

  const {
    todos,
    projects,
    isLoadingTodos,
    isLoadingProjects,
    fetchTodos,
    fetchProjects,
    upsertTodo,
    upsertProject,
    removeTodo: removeTodoFromStore,
  } = useTodoStore();

  const todosRef = useRef(todos);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const project = useMemo(
    () => projects.find((p) => p.project_id === projectId) ?? null,
    [projects, projectId]
  );

  const currentStatuses: ProjectStatus[] = useMemo(() => {
    if (!project) return [];
    return [...project.project_statuses].sort((a, b) => a.status_order - b.status_order);
  }, [project]);
  const canManageProject = useMemo(
    () => (project ? isProjectCreator(project, currentUserId) : false),
    [project, currentUserId]
  );

  const isLoading = isLoadingTodos || isLoadingProjects;

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [form, setForm] = useState<FormState>(makeDefaultForm(projectId));
  const [formAssignees, setFormAssignees] = useState<Set<string>>(new Set());
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ id: string; name: string; avatar?: string }>
  >([]);

  // ── Drag & Drop state ───────────────────────────────────────────────────────
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  // ── Assign state ────────────────────────────────────────────────────────────
  const [assigningTodo, setAssigningTodo] = useState<TodoItem | null>(null);
  const [friends, setFriends] = useState<ContactType[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const friendsLoadedRef = useRef(false);
  const loadingFriendsRef = useRef(false);
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isAssignOpen, onOpen: onAssignOpen, onClose: onAssignClose } = useDisclosure();
  const { isOpen: isStatusFormOpen, onOpen: onStatusFormOpen, onClose: onStatusFormClose } = useDisclosure();
  const { isOpen: isDeleteStatusOpen, onOpen: onDeleteStatusOpen, onClose: onDeleteStatusClose } = useDisclosure();
  const { isOpen: isMembersOpen, onOpen: onMembersOpen, onClose: onMembersClose } = useDisclosure();

  // ── Members state ────────────────────────────────────────────────────────────
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, ContactType>>({});
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<ContactType[]>([]);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isLeavingProject, setIsLeavingProject] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [removeConfirmMemberId, setRemoveConfirmMemberId] = useState<string | null>(null);

  // ── Share state ──────────────────────────────────────────────────────────────
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [sharingRoomId, setSharingRoomId] = useState<string | null>(null);
  const [sharedRoomIds, setSharedRoomIds] = useState<Set<string>>(new Set());
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // ── Status form state ────────────────────────────────────────────────────────
  const [statusForm, setStatusForm] = useState<CreateProjectStatusPayload>({
    status_name: "",
    status_color: "gray",
  });
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);
  const [isDeletingStatus, setIsDeletingStatus] = useState(false);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projects.length) void fetchProjects();
  }, [fetchProjects, projects.length]);

  useEffect(() => {
    void fetchTodos({ projectId });
  }, [fetchTodos, projectId]);

  // ── Socket: subscribe realtime todo updates by projectId ────────────────
  const handleSocketUpdateTodo = useCallback(
    (msg: any) => {
      if (!msg || msg.projectId !== projectId) return;

      const payload: any = msg?.payload ?? {};
      const todoId: string | undefined =
        msg.todoId ??
        payload.todoId ??
        payload?.todo?.todo_id ??
        payload?.todo_id ??
        payload?.todo?.id;

      const newStatus: string | undefined =
        payload.status ??
        payload.todo_status ??
        payload?.todo?.todo_status ??
        payload?.todo?.status;

      if (!todoId) return;

      const existing = todosRef.current.find((td) => td.todo_id === todoId);
      if (existing) {
        const todoFromPayload = payload?.todo ?? payload;
        upsertTodo({
          ...existing,
          ...todoFromPayload,
          todo_id: todoId,
          todo_status: newStatus ?? existing.todo_status,
        });
      } else {
        // If local cache doesn't contain the todo yet, refetch the list.
        if (payload?.todo) {
          const todoFromPayload = payload.todo;
          upsertTodo({
            ...todoFromPayload,
            todo_id: todoId,
            todo_status: newStatus ?? todoFromPayload.todo_status,
          });
        } else {
          void fetchTodos({ projectId });
        }
      }
    },
    [projectId, fetchTodos, upsertTodo]
  );

  useEffect(() => {
    if (!socket || !projectId) return;

    const joinRoom = () => {
      socket.emit("join", { roomId: projectId });
    };

    if (socket.connected) joinRoom();
    else {
      connect();
      socket.once("connect", joinRoom);
    }

    socket.off("update:todo", handleSocketUpdateTodo);
    socket.on("update:todo", handleSocketUpdateTodo);

    return () => {
      socket.off("update:todo", handleSocketUpdateTodo);
      socket.off("connect", joinRoom);
    };
  }, [socket, projectId, connect, handleSocketUpdateTodo]);

  // ── Friends ──────────────────────────────────────────────────────────────────
  const ensureFriendsLoaded = useCallback(async () => {
    if (friendsLoadedRef.current || loadingFriendsRef.current) return;
    loadingFriendsRef.current = true;
    setIsLoadingFriends(true);
    try {
      const list = await getFriends();
      const normalized = list ?? storeFriends ?? [];
      setFriends(normalized);
      friendsLoadedRef.current = true;
    } catch {
      if ((storeFriends ?? []).length > 0) {
        setFriends(storeFriends ?? []);
        friendsLoadedRef.current = true;
      }
    } finally {
      loadingFriendsRef.current = false;
      setIsLoadingFriends(false);
    }
  }, [getFriends, storeFriends]);

  const loadProjectAssignees = useCallback(async (search?: string) => {
    if (!projectId) return;
    setIsLoadingAssignees(true);
    try {
      const result = await todoService.getProjectMembers(projectId, search);
      const members = result?.members ?? [];
      const options = members.map((member) => {
        const isMe = member._id === (currentUser?._id ?? currentUser?.id);
        const baseName = isMe ? currentUser?.fullname ?? "Me" : member.fullname;
        return {
          id: member._id,
          name: isMe ? `${baseName} (${t("todo.projects.members.you")})` : baseName,
          avatar: isMe ? currentUser?.avatar ?? undefined : undefined,
        };
      });
      setAssigneeOptions(options);
    } catch {
      setAssigneeOptions([]);
    } finally {
      setIsLoadingAssignees(false);
    }
  }, [projectId, currentUser, t]);

  // ── Error helper ─────────────────────────────────────────────────────────────
  const extractErrorMessage = (err: unknown): string => {
    if (!err || typeof err !== "object") return t("todo.error.generic");
    const e = err as any;
    const raw: string = e?.message ?? e?.error ?? "";
    if (raw.includes("Project not found")) return t("todo.error.projectNotFound");
    if (raw.includes("Status is not allowed")) return t("todo.error.statusNotAllowed");
    if (raw.includes("Status already exists")) return t("todo.error.statusExists");
    return raw || t("todo.error.generic");
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  const openCreateModal = useCallback(
    (initialStatusId?: string) => {
      void loadProjectAssignees();
      setEditingTodo(null);
      setFormAssignees(new Set());
      const firstStatus = currentStatuses[0]?.status_id ?? "";
      setForm(makeDefaultForm(projectId, initialStatusId ?? firstStatus));
      onFormOpen();
    },
    [loadProjectAssignees, currentStatuses, projectId, onFormOpen]
  );

  const openEditModal = useCallback(
    (todo: TodoItem) => {
      void loadProjectAssignees();
      setEditingTodo(todo);
      setFormAssignees(new Set(todo.todo_assignees ?? []));
      setForm({
        todo_id: todo.todo_id,
        todo_title: todo.todo_title,
        todo_createdBy: todo.todo_createdBy,
        todo_description: todo.todo_description ?? "",
        todo_status: todo.todo_status,
        todo_priority: todo.todo_priority,
        todo_dueDate: todo.todo_dueDate ? todo.todo_dueDate.split("T")[0] : "",
        todo_projectId: projectId,
      });
      onFormOpen();
    },
    [loadProjectAssignees, projectId, onFormOpen]
  );

  const handleFormClose = () => {
    setEditingTodo(null);
    setForm(makeDefaultForm(projectId));
    setFormAssignees(new Set());
    onFormClose();
  };

  const assigneesEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((id, i) => id === sb[i]);
  };

  const handleSubmit = async () => {
    if (!form.todo_title.trim()) return;
    try {
      setIsSubmitting(true);
      const assigneeIds = Array.from(formAssignees);
      if (editingTodo) {
        const payload: UpdateTodoPayload = {
          todo_title: form.todo_title,
          todo_description: form.todo_description,
          todo_status: form.todo_status,
          todo_priority: form.todo_priority,
          todo_dueDate: form.todo_dueDate ? new Date(form.todo_dueDate).toISOString() : "",
          todo_projectId: projectId,
        };
        const updated = await todoService.updateTodo(editingTodo.todo_id, payload);
        let assigned: TodoItem | null = null;
        if (!assigneesEqual(assigneeIds, editingTodo.todo_assignees ?? [])) {
          assigned = await todoService.assignTodo(editingTodo.todo_id, assigneeIds);
        }
        if (updated) {
          upsertTodo(updated);
          if (socket) {
            if (!socket.connected) connect();
            socket.emit("update:todo", {
              projectId,
              todoId: updated.todo_id,
              payload: {
                status: updated.todo_status,
                updatedAt: updated.updatedAt,
                todo: updated,
              },
            });
          }
        }
        if (assigned) {
          upsertTodo(assigned);
          if (socket) {
            if (!socket.connected) connect();
            socket.emit("update:todo", {
              projectId,
              todoId: assigned.todo_id,
              payload: {
                status: assigned.todo_status,
                updatedAt: assigned.updatedAt,
                todo: assigned,
              },
            });
          }
        }
      } else {
        const payload: Omit<CreateTodoPayload, "todo_createdBy"> = {
          todo_title: form.todo_title,
          todo_description: form.todo_description,
          todo_status: form.todo_status,
          todo_priority: form.todo_priority,
          todo_dueDate: form.todo_dueDate ? new Date(form.todo_dueDate).toISOString() : undefined,
          todo_projectId: projectId,
          ...(assigneeIds.length > 0 ? { todo_assignees: assigneeIds } : {}),
        };
        const created = await todoService.createTodo(payload);
        if (created) {
          upsertTodo(created);
          if (socket) {
            if (!socket.connected) connect();
            socket.emit("update:todo", {
              projectId,
              todoId: created.todo_id,
              payload: {
                status: created.todo_status,
                updatedAt: created.updatedAt,
                todo: created,
              },
            });
          }
        }
      }
      await fetchTodos({ projectId });
      handleFormClose();
      toast.success(editingTodo ? t("todo.toast.saved") : t("todo.toast.created"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteClick = (id: string) => {
    setTodoToDelete(id);
    onDeleteOpen();
  };

  const handleConfirmDelete = async () => {
    if (!todoToDelete) return;
    try {
      setIsDeleting(true);
      await todoService.deleteTodo(todoToDelete);
      removeTodoFromStore(todoToDelete);
      onDeleteClose();
      setTodoToDelete(null);
      toast.success(t("todo.toast.deleted"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Status change ─────────────────────────────────────────────────────────────
  const handleStatusChange = async (todo: TodoItem, newStatus: string) => {
    upsertTodo({ ...todo, todo_status: newStatus });
    try {
      const updated = await todoService.updateTodoStatus(todo.todo_id, newStatus);
      if (updated) {
        upsertTodo(updated);
        if (socket) {
          if (!socket.connected) connect();
          socket.emit("update:todo", {
            projectId,
            todoId: updated.todo_id,
            payload: {
              status: updated.todo_status ?? newStatus,
              updatedAt: updated.updatedAt,
              todo: updated,
            },
          });
        }
      }
    } catch (err) {
      upsertTodo(todo);
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    }
  };

  // ── Assign ────────────────────────────────────────────────────────────────────
  const openAssignModal = async (todo: TodoItem) => {
    void loadProjectAssignees();
    setAssigningTodo(todo);
    setSelectedAssignees(new Set(todo.todo_assignees));
    onAssignOpen();
  };

  const handleAssignClose = () => {
    setAssigningTodo(null);
    setSelectedAssignees(new Set());
    onAssignClose();
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleConfirmAssign = async () => {
    if (!assigningTodo) return;
    try {
      setIsAssigning(true);
      const updated = await todoService.assignTodo(
        assigningTodo.todo_id,
        Array.from(selectedAssignees)
      );
      if (updated) {
        upsertTodo(updated);
        if (socket) {
          if (!socket.connected) connect();
          socket.emit("update:todo", {
            projectId,
            todoId: updated.todo_id,
            payload: {
              status: updated.todo_status,
              updatedAt: updated.updatedAt,
              todo: updated,
            },
          });
        }
      }
      handleAssignClose();
      toast.success(t("todo.toast.assignUpdated"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Add / Edit / Delete status ────────────────────────────────────────────────

  const openAddStatusModal = () => {
    setEditingStatus(null);
    setStatusForm({ status_name: "", status_color: "gray" });
    onStatusFormOpen();
  };

  const openEditStatusModal = (status: ProjectStatus) => {
    if (!canManageProject) {
      toast.error(t("todo.projects.error.onlyCreator"));
      return;
    }
    setEditingStatus(status);
    setStatusForm({ status_name: status.status_name, status_color: status.status_color ?? "gray" });
    onStatusFormOpen();
  };

  const handleSubmitStatus = async () => {
    if (!project || !statusForm.status_name.trim()) return;
    if (editingStatus && !canManageProject) {
      toast.error(t("todo.projects.error.onlyCreator"));
      onStatusFormClose();
      return;
    }
    try {
      setIsSubmittingStatus(true);
      let updatedProject: TodoProject;
      if (editingStatus) {
        updatedProject = await todoService.updateProjectStatus(
          project.project_id,
          editingStatus.status_id,
          { status_name: statusForm.status_name, status_color: statusForm.status_color }
        );
      } else {
        updatedProject = await todoService.addProjectStatus(project.project_id, statusForm);
      }
      upsertProject(updatedProject);
      onStatusFormClose();
      toast.success(
        editingStatus
          ? t("todo.projects.status.toast.updated")
          : t("todo.projects.status.toast.added")
      );
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleDeleteStatus = async () => {
    if (!project || !deletingStatusId) return;
    if (!canManageProject) {
      toast.error(t("todo.projects.error.onlyCreator"));
      onDeleteStatusClose();
      return;
    }
    try {
      setIsDeletingStatus(true);
      const updatedProject = await todoService.deleteProjectStatus(project.project_id, deletingStatusId);
      upsertProject(updatedProject);
      onDeleteStatusClose();
      setDeletingStatusId(null);
      toast.success(t("todo.projects.status.toast.deleted"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsDeletingStatus(false);
    }
  };

  // ── Members ───────────────────────────────────────────────────────────────────

  const openMembersModal = async () => {
    if (!project) return;
    onMembersOpen();
    void ensureFriendsLoaded();
    setMemberSearchQuery("");
    setMemberSearchResults([]);
    setIsLoadingMembers(true);
    try {
      const result = await todoService.getProjectMembers(project.project_id);
      const ids = result?.member_ids ?? [];
      setMemberIds(ids);
      const mappedProfiles: Record<string, ContactType> = {};
      for (const member of result?.members ?? []) {
        const memberId = member?._id ?? member?.id;
        if (!memberId) continue;
        mappedProfiles[memberId] = member;
      }
      setMemberProfiles(mappedProfiles);
    } catch {
      setMemberIds(project.project_members ?? []);
      setMemberProfiles({});
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleMemberSearchChange = useCallback((query: string) => {
    setMemberSearchQuery(query);
    if (!query.trim()) { setMemberSearchResults([]); return; }
    const q = query.trim().toLowerCase();
    const results = friends.filter(
      (f) =>
        f.fullname?.toLowerCase().includes(q) ||
        f.email?.toLowerCase().includes(q)
    );
    setMemberSearchResults(results);
  }, [friends]);

  const handleAddMember = async (userId: string) => {
    if (!project || !userId) return;
    setAddingMemberId(userId);
    try {
      const updated = await todoService.addProjectMember(project.project_id, userId);
      upsertProject(updated);
      setMemberIds(updated.project_members ?? []);
      setMemberSearchQuery("");
      setMemberSearchResults([]);
      toast.success(t("todo.projects.members.toast.added"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!project) return;
    setRemovingMemberId(memberId);
    try {
      const updated = await todoService.removeProjectMember(project.project_id, memberId);
      upsertProject(updated);
      setMemberIds(updated.project_members ?? []);
      setRemoveConfirmMemberId(null);
      toast.success(t("todo.projects.members.toast.removed"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleLeaveProject = async () => {
    if (!project) return;
    setIsLeavingProject(true);
    try {
      await todoService.leaveProject(project.project_id);
      setLeaveConfirmOpen(false);
      onMembersClose();
      toast.success(t("todo.projects.members.toast.left"));
      router.push("/todo");
    } catch (err) {
      const e = err as any;
      const msg: string = e?.message ?? e?.error ?? "";
      if (msg.includes("Cannot remove project creator")) {
        toast.error(t("todo.projects.members.error.cannotLeave"));
      } else {
        toast.error(extractErrorMessage(err), t("todo.toast.error"));
      }
    } finally {
      setIsLeavingProject(false);
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────────

  const filteredRooms = useMemo(() => {
    const q = shareSearchQuery.trim().toLowerCase();
    const sorted = [...rooms].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!q) return sorted.slice(0, 10);
    return sorted.filter((r) => (r.name ?? "").toLowerCase().includes(q));
  }, [rooms, shareSearchQuery]);

  const handleShareToRoom = async (room: roomType) => {
    if (!project || !socket || sharingRoomId === room.id) return;
    setSharingRoomId(room.id);
    try {
      const projectUrl = `${window.location.origin}/todo/${project.project_id}`;
      const shareContent = `${currentUser?.fullname ?? "Bạn"} đã chia sẻ dự án ${project.project_name}. Hãy tham gia cùng nhau nhé\n${
        project.project_description ? `📌 ${project.project_description}\n` : ""
      }`;
      await sendMessage({
        roomId: room.id,
        content: shareContent,
        attachments: [],
        type: "todo_project",
        todoProjectId: project.project_id,
        socket,
        userId: currentUserId,
        userFullname: currentUser?.fullname ?? "",
        userAvatar: currentUser?.avatar ?? "",
      });
      setSharedRoomIds((prev) => new Set([...prev, room.id]));
    } catch {
      toast.error(t("todo.share.error"));
    } finally {
      setSharingRoomId(null);
    }
  };

  const openShareModal = async () => {
    setShareSearchQuery("");
    setSharedRoomIds(new Set());
    setIsShareOpen(true);
    setIsLoadingRooms(true);
    try {
      // Load từ IndexedDB trước (fast), sau đó fetch API để cập nhật
      await getRoomsByType("all");
      await getRooms({});
    } catch {
      // IndexedDB fallback đã có trong store
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, todoId: string) => {
    e.dataTransfer.setData("todo_id", todoId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTodoId(todoId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTodoId(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
  }, []);

  const handleColumnDragEnter = useCallback((e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    dragCounterRef.current[statusId] = (dragCounterRef.current[statusId] ?? 0) + 1;
    setDragOverColumn(statusId);
  }, []);

  const handleColumnDragLeave = useCallback((e: React.DragEvent, statusId: string) => {
    dragCounterRef.current[statusId] = (dragCounterRef.current[statusId] ?? 1) - 1;
    if (dragCounterRef.current[statusId] <= 0) {
      dragCounterRef.current[statusId] = 0;
      setDragOverColumn((prev) => (prev === statusId ? null : prev));
    }
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleColumnDrop = useCallback(
    async (e: React.DragEvent, targetStatusId: string) => {
      e.preventDefault();
      const todoId = e.dataTransfer.getData("todo_id");
      setDragOverColumn(null);
      setDraggingTodoId(null);
      dragCounterRef.current = {};
      if (!todoId) return;
      const todo = todos.find((t) => t.todo_id === todoId);
      if (!todo || todo.todo_status === targetStatusId) return;
      upsertTodo({ ...todo, todo_status: targetStatusId });
      try {
        const updated = await todoService.updateTodoStatus(todoId, targetStatusId);
        if (updated) {
          upsertTodo(updated);
          if (socket) {
            if (!socket.connected) connect();
            socket.emit("update:todo", {
              projectId,
              todoId: updated.todo_id,
              payload: {
                status: updated.todo_status ?? targetStatusId,
                updatedAt: updated.updatedAt,
                todo: updated,
              },
            });
          }
        }
      } catch (err) {
        upsertTodo(todo);
        toast.error(extractErrorMessage(err), t("todo.toast.dragError"));
      }
    },
    [todos, upsertTodo, t, socket, connect, projectId]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getTodosByStatus = (statusId: string) =>
    todos.filter((td) => td.todo_status === statusId);

  const formatDueDate = (dueDate: string) => {
    if (!dueDate) return null;
    try {
      const date = parseISO(dueDate);
      if (!isValid(date)) return null;
      return format(date, "dd/MM/yyyy", { locale: viLocale });
    } catch {
      return null;
    }
  };

  const isDueDateOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    try {
      return isPast(parseISO(dueDate));
    } catch {
      return false;
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (isLoading && !project) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  // ── Render: project not found ──────────────────────────────────────────────
  if (!isLoading && !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
        <p className="text-lg font-semibold text-gray-800 dark:text-white">
          {t("todo.kanban.notFound")}
        </p>
        <p className="text-sm text-gray-500">{t("todo.kanban.notFoundDesc")}</p>
        <Button
          color="primary"
          variant="flat"
          onPress={() => router.push("/todo")}
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
        >
          {t("todo.kanban.backBtn")}
        </Button>
      </div>
    );
  }

  // ── Render: kanban ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <Button
          as={Link}
          href="/todo"
          variant="light"
          size="sm"
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
          className="text-gray-500 dark:text-gray-400 shrink-0"
        >
          {t("todo.kanban.backToProjects")}
        </Button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">
            {project?.project_name}
          </h1>
          {project?.project_description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {project.project_description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="flat"
            size="sm"
            startContent={<ShareIcon className="w-4 h-4" />}
            onPress={openShareModal}
          >
            {t("todo.share.btn")}
          </Button>
          <Button
            variant="flat"
            size="sm"
            startContent={<UsersIcon className="w-4 h-4" />}
            onPress={openMembersModal}
          >
            {t("todo.projects.members.title")}
            {(project?.project_members?.length ?? 0) > 0 && (
              <span className="ml-1 text-xs font-bold bg-primary/20 text-primary rounded-full px-1.5 py-0.5 leading-none">
                {project?.project_members?.length}
              </span>
            )}
          </Button>
          <Button
            variant="flat"
            size="sm"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={openAddStatusModal}
          >
            {t("todo.projects.status.add")}
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={() => openCreateModal()}
          >
            {t("todo.create")}
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoadingTodos ? (
        <div className="flex justify-center items-center flex-1 py-16">
          <Spinner size="lg" color="primary" aria-label={t("common.loading")} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4 sm:p-5">
          <div
            className="flex gap-4 h-full min-h-[calc(100vh-120px)]"
            style={{ minWidth: `${currentStatuses.length * 240}px` }}
          >
            {currentStatuses.map((status, idx) => {
              const palette = getStatusPaletteByColor(status.status_color);
              const columnTodos = getTodosByStatus(status.status_id);
              const isOver = dragOverColumn === status.status_id;

              return (
                <div
                  key={status.status_id}
                  onDragEnter={(e) => handleColumnDragEnter(e, status.status_id)}
                  onDragLeave={(e) => handleColumnDragLeave(e, status.status_id)}
                  onDragOver={handleColumnDragOver}
                  onDrop={(e) => handleColumnDrop(e, status.status_id)}
                  className={`
                    flex flex-col flex-1 min-w-[220px] max-w-xs rounded-xl
                    border border-gray-200 dark:border-gray-700 transition-all duration-150
                    ${isOver ? palette.dropActiveClass : palette.bgClass}
                  `}
                >
                  {/* Column Header */}
                  <div className={`flex items-center gap-1 px-3 py-2.5 rounded-t-xl ${palette.headerClass}`}>
                    <span className="font-semibold text-sm truncate flex-1 min-w-0">
                      {status.status_name}
                    </span>
                    <span className="text-xs font-bold bg-white/40 dark:bg-black/20 rounded-full px-2 py-0.5 shrink-0">
                      {columnTodos.length}
                    </span>
                    {/* Column actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canManageProject && (
                        <>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="opacity-60 hover:opacity-100 w-7 h-7 min-w-0"
                            onPress={() => openEditStatusModal(status)}
                            aria-label={t("todo.projects.status.edit")}
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            className="opacity-60 hover:opacity-100 w-7 h-7 min-w-0"
                            isDisabled={currentStatuses.length <= 1}
                            onPress={() => {
                              setDeletingStatusId(status.status_id);
                              onDeleteStatusOpen();
                            }}
                            aria-label={t("todo.projects.status.delete")}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="opacity-70 hover:opacity-100 w-7 h-7 min-w-0"
                        onPress={() => openCreateModal(status.status_id)}
                        aria-label={t("todo.column.addToColumn", { name: status.status_name })}
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollShadow className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnTodos.length === 0 ? (
                      <div
                        className={`
                          flex items-center justify-center rounded-lg border-2 border-dashed
                          transition-all duration-150 text-xs py-8
                          ${isOver
                            ? "border-current opacity-60 scale-[0.98]"
                            : "border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600"}
                        `}
                      >
                        {isOver ? t("todo.column.dropHere") : t("todo.column.empty")}
                      </div>
                    ) : (
                      columnTodos.map((todo) => (
                        <TodoCard
                          key={todo.todo_id}
                          todo={todo}
                          statuses={currentStatuses}
                          isDragging={draggingTodoId === todo.todo_id}
                          onEdit={openEditModal}
                          onDelete={handleDeleteClick}
                          onStatusChange={handleStatusChange}
                          onAssign={openAssignModal}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          formatDueDate={formatDueDate}
                          isDueDateOverdue={isDueDateOverdue}
                          t={t}
                        />
                      ))
                    )}
                  </ScrollShadow>

                  <div className="p-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <Button
                      variant="light"
                      size="sm"
                      className="w-full text-gray-500 dark:text-gray-400 justify-start gap-2 hover:bg-white/50 dark:hover:bg-white/5"
                      startContent={<PlusIcon className="w-4 h-4" />}
                      onPress={() => openCreateModal(status.status_id)}
                    >
                      {t("todo.column.addTask")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={handleFormClose} size="md" placement="center" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="text-lg font-semibold">
            {editingTodo ? t("todo.form.editTitle") : t("todo.form.createTitle")}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label={t("todo.form.titleLabel")}
              placeholder={t("todo.form.titlePlaceholder")}
              value={form.todo_title}
              onValueChange={(v) => setForm((f) => ({ ...f, todo_title: v }))}
              isRequired
              variant="bordered"
            />
            <Textarea
              label={t("todo.form.descLabel")}
              placeholder={t("todo.form.descPlaceholder")}
              value={form.todo_description ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, todo_description: v }))}
              variant="bordered"
              minRows={2}
              maxRows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label={t("todo.form.statusLabel")}
                selectedKeys={form.todo_status ? [form.todo_status] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  setForm((f) => ({ ...f, todo_status: val }));
                }}
                variant="bordered"
              >
                {currentStatuses.map((s) => (
                  <SelectItem key={s.status_id} textValue={s.status_name}>
                    {s.status_name}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("todo.form.priorityLabel")}
                selectedKeys={form.todo_priority ? [form.todo_priority] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as TodoPriority;
                  setForm((f) => ({ ...f, todo_priority: val }));
                }}
                variant="bordered"
              >
                {(["high", "medium", "low"] as TodoPriority[]).map((p) => (
                  <SelectItem key={p} textValue={t(`todo.priority.${p}`)}>
                    {t(`todo.priority.${p}`)}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label={t("todo.form.dueDateLabel")}
              type="date"
              value={form.todo_dueDate ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, todo_dueDate: v }))}
              variant="bordered"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("todo.form.assignLabel")}</label>
              <p className="text-xs text-default-500 -mt-1">{t("todo.form.assignHint")}</p>
              {isLoadingAssignees ? (
                <div className="flex justify-center py-4"><Spinner size="sm" color="primary" /></div>
              ) : assigneeOptions.length === 0 ? (
                <p className="text-xs text-default-400 text-center py-2">{t("todo.form.noFriends")}</p>
              ) : (
                <Select
                  aria-label={t("todo.form.assignLabel")}
                  selectionMode="multiple"
                  placeholder={t("todo.form.assignPlaceholder")}
                  selectedKeys={formAssignees}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    setFormAssignees(new Set(Array.from(keys as Set<string>)));
                  }}
                  variant="bordered"
                  classNames={{ trigger: "min-h-12", value: "text-small" }}
                  renderValue={(items) => {
                    if (items.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {items.map((item) => (
                          <Chip key={item.key} size="sm" variant="flat" color="primary" classNames={{ content: "text-tiny" }}>
                            {item.textValue}
                          </Chip>
                        ))}
                      </div>
                    );
                  }}
                >
                  {assigneeOptions.map((f) => (
                    <SelectItem
                      key={f.id}
                      textValue={f.name}
                      startContent={<Avatar className="w-6 h-6" src={f.avatar ?? undefined} name={f.name} size="sm" />}
                    >
                      {f.name}
                    </SelectItem>
                  ))}
                </Select>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleFormClose}>{t("todo.form.cancel")}</Button>
            <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting} isDisabled={!form.todo_title.trim()}>
              {editingTodo ? t("todo.form.save") : t("todo.form.createSubmit")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={isAssignOpen} onClose={handleAssignClose} size="sm" placement="center" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-base font-semibold">{t("todo.assign.title")}</span>
            {assigningTodo && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 line-clamp-1">
                {assigningTodo.todo_title}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="pb-2">
            {isLoadingFriends ? (
              <div className="flex justify-center py-6"><Spinner size="sm" color="primary" /></div>
            ) : assigneeOptions.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">{t("todo.assign.noFriends")}</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {assigneeOptions.map((friend) => {
                  const isSelected = selectedAssignees.has(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleAssignee(friend.id)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-100
                        ${isSelected ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-gray-100 dark:hover:bg-gray-800"}
                      `}
                    >
                      <Avatar src={friend.avatar ?? undefined} name={friend.name} size="sm" className="shrink-0" />
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{friend.name}</span>
                      <Checkbox isSelected={isSelected} color="primary" size="sm" onChange={() => toggleAssignee(friend.id)} aria-label={`Chọn ${friend.name}`} />
                    </div>
                  );
                })}
              </div>
            )}
            {selectedAssignees.size > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 self-center">{t("todo.assign.selected")}</span>
                {Array.from(selectedAssignees).map((id) => {
                  const f = assigneeOptions.find((x) => x.id === id);
                  if (!f) return null;
                  return (
                    <Chip key={id} size="sm" variant="flat" color="primary"
                      avatar={<Avatar src={f.avatar ?? undefined} name={f.name} size="sm" />}
                      onClose={() => toggleAssignee(id)}
                    >
                      {f.name}
                    </Chip>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleAssignClose}>{t("todo.assign.cancel")}</Button>
            <Button color="primary" onPress={handleConfirmAssign} isLoading={isAssigning}>
              {t("todo.assign.confirm", { count: selectedAssignees.size })}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleConfirmDelete}
        title={t("todo.delete.title")}
        content={t("todo.delete.content")}
        confirmText={t("todo.delete.confirm")}
        cancelText={t("todo.delete.cancel")}
        color="danger"
        isLoading={isDeleting}
      />

      {/* Add / Edit status modal */}
      <Modal isOpen={isStatusFormOpen} onClose={onStatusFormClose} size="sm" placement="center">
        <ModalContent>
          <ModalHeader>
            {editingStatus
              ? t("todo.projects.status.form.editTitle")
              : t("todo.projects.status.form.addTitle")}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label={t("todo.projects.status.form.nameLabel")}
              placeholder={t("todo.projects.status.form.namePlaceholder")}
              value={statusForm.status_name}
              onValueChange={(v) => setStatusForm((f) => ({ ...f, status_name: v }))}
              isRequired
              variant="bordered"
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <SwatchIcon className="w-4 h-4" />
                {t("todo.projects.status.form.colorLabel")}
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {STATUS_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setStatusForm((f) => ({ ...f, status_color: c.value }))}
                    className={`
                      w-7 h-7 rounded-full transition-transform
                      ${c.class}
                      ${statusForm.status_color === c.value
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : "hover:scale-105"}
                    `}
                    aria-label={c.label}
                    title={c.label}
                  />
                ))}
              </div>
              {statusForm.status_color && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-3 h-3 rounded-full ${getColorClassKanban(statusForm.status_color)}`} />
                  <span className="text-xs text-gray-500">
                    {STATUS_COLOR_OPTIONS.find((c) => c.value === statusForm.status_color)?.label}
                  </span>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onStatusFormClose}>
              {t("todo.projects.status.form.cancel")}
            </Button>
            <Button
              color="primary"
              onPress={handleSubmitStatus}
              isLoading={isSubmittingStatus}
              isDisabled={!statusForm.status_name.trim()}
            >
              {editingStatus
                ? t("todo.projects.status.form.save")
                : t("todo.projects.status.form.add")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete status confirm */}
      <ConfirmModal
        isOpen={isDeleteStatusOpen}
        onClose={onDeleteStatusClose}
        onConfirm={handleDeleteStatus}
        title={t("todo.projects.status.deleteModal.title")}
        content={t("todo.projects.status.deleteModal.content")}
        confirmText={t("todo.projects.status.deleteModal.confirm")}
        cancelText={t("todo.projects.status.deleteModal.cancel")}
        color="danger"
        isLoading={isDeletingStatus}
      />

      {/* Members modal */}
      <Modal isOpen={isMembersOpen} onClose={onMembersClose} size="sm" placement="center" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary shrink-0" />
            <span>{t("todo.projects.members.title")}</span>
          </ModalHeader>
          <ModalBody className="pb-2 gap-4">
            {/* Search & add member — owner only */}
            {project && isProjectCreator(project, currentUserId) && (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    size="sm"
                    placeholder={t("todo.projects.members.searchPlaceholder")}
                    value={memberSearchQuery}
                    onValueChange={handleMemberSearchChange}
                    variant="bordered"
                    startContent={
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                    }
                    isClearable
                    onClear={() => { setMemberSearchQuery(""); setMemberSearchResults([]); }}
                  />
                </div>

                {/* Search results */}
                {memberSearchResults.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                    {memberSearchResults
                      .filter((u) => !memberIds.includes(u._id) && !memberIds.includes(u.id))
                      .map((user) => {
                        const userId = user._id || user.id;
                        const isAdding = addingMemberId === userId;
                        return (
                          <div
                            key={userId}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700/50 cursor-pointer"
                            onClick={() => !isAdding && handleAddMember(userId)}
                          >
                            <Avatar
                              src={user.avatar ?? undefined}
                              name={user.fullname}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {user.fullname}
                              </p>
                              {user.email && (
                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              isLoading={isAdding}
                              isDisabled={!!addingMemberId}
                              onPress={() => handleAddMember(userId)}
                              className="shrink-0 h-7 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t("todo.projects.members.addBtn")}
                            </Button>
                          </div>
                        );
                      })}
                    {memberSearchResults.filter((u) => !memberIds.includes(u._id) && !memberIds.includes(u.id)).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">
                        {t("todo.projects.members.allAdded")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Member list */}
            {isLoadingMembers ? (
              <div className="flex justify-center py-6"><Spinner size="sm" color="primary" /></div>
            ) : memberIds.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">{t("todo.projects.members.noMembers")}</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {memberIds.map((memberId) => {
                  const isMe = memberId === currentUserId;
                  const isOwner = project ? isProjectCreator(project, memberId) : false;
                  const memberInfo =
                    memberProfiles[memberId] ??
                    friends.find((f) => f._id === memberId || f.id === memberId);
                  const displayName = memberInfo?.fullname ?? memberId;
                  return (
                    <div
                      key={memberId}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
                    >
                      <Avatar
                        src={(memberInfo as any)?.avatar ?? undefined}
                        name={displayName}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {displayName}
                          {isMe && <span className="text-xs text-gray-400 ml-1">({t("todo.projects.members.you")})</span>}
                        </p>
                      </div>
                      {isOwner ? (
                        <Chip size="sm" variant="flat" color="primary" className="text-[11px] h-5 shrink-0">
                          {t("todo.projects.members.ownerBadge")}
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color="secondary" className="text-[11px] h-5 shrink-0">
                          {t("todo.projects.members.memberBadge")}
                        </Chip>
                      )}
                      {/* Remove: only owner can remove non-owner members */}
                      {project && isProjectCreator(project, currentUserId) && !isOwner && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          className="w-7 h-7 min-w-0 shrink-0"
                          isLoading={removingMemberId === memberId}
                          onPress={() => setRemoveConfirmMemberId(memberId)}
                          aria-label={t("todo.projects.members.removeBtn")}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <ModalFooter className="justify-between">
            {/* Leave project — non-owner members */}
            {project && !isProjectCreator(project, currentUserId) && (
              <Button
                color="danger"
                variant="flat"
                size="sm"
                startContent={<ArrowRightStartOnRectangleIcon className="w-4 h-4" />}
                onPress={() => setLeaveConfirmOpen(true)}
              >
                {t("todo.projects.members.leaveBtn")}
              </Button>
            )}
            <Button variant="flat" onPress={onMembersClose} className="ml-auto">
              {t("common.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Leave project confirm */}
      <ConfirmModal
        isOpen={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeaveProject}
        title={t("todo.projects.members.leaveConfirmTitle")}
        content={t("todo.projects.members.leaveConfirmContent")}
        confirmText={t("todo.projects.members.leaveConfirm")}
        cancelText={t("todo.projects.members.leaveCancel")}
        color="danger"
        isLoading={isLeavingProject}
      />

      {/* Remove member confirm */}
      <ConfirmModal
        isOpen={!!removeConfirmMemberId}
        onClose={() => setRemoveConfirmMemberId(null)}
        onConfirm={() => { if (removeConfirmMemberId) void handleRemoveMember(removeConfirmMemberId); }}
        title={t("todo.projects.members.removeConfirmTitle")}
        content={t("todo.projects.members.removeConfirmContent")}
        confirmText={t("todo.projects.members.removeConfirm")}
        cancelText={t("todo.projects.members.removeCancel")}
        color="danger"
        isLoading={!!removingMemberId}
      />

      {/* Share modal */}
      <Modal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        size="sm"
        placement="center"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <ShareIcon className="w-5 h-5 text-primary shrink-0" />
            <span>{t("todo.share.title")}</span>
          </ModalHeader>
          <ModalBody className="pb-2 gap-3">
            {/* Project preview */}
            <div className="px-3 py-2.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                📋 {project?.project_name}
              </p>
              {project?.project_description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {project.project_description}
                </p>
              )}
            </div>

            {/* Room search */}
            <Input
              size="sm"
              placeholder={t("todo.share.searchPlaceholder")}
              value={shareSearchQuery}
              onValueChange={setShareSearchQuery}
              variant="bordered"
              startContent={
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              }
              isClearable
              onClear={() => setShareSearchQuery("")}
            />

            {/* Room list */}
            {isLoadingRooms ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" color="primary" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-6">{t("todo.share.noRooms")}</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {filteredRooms.map((room) => {
                  const isShared = sharedRoomIds.has(room.id);
                  const isSharing = sharingRoomId === room.id;
                  const roomName = room.name ?? t("todo.share.unnamedRoom");
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer border
                        ${isShared
                          ? "bg-success/10 border-success/30 dark:bg-success/10"
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      onClick={() => !isShared && !isSharing && handleShareToRoom(room)}
                    >
                      <Avatar
                        src={room.avatar ?? undefined}
                        name={roomName}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {roomName}
                        </p>
                        <p className="text-[11px] text-gray-400 capitalize">{room.type}</p>
                      </div>
                      {isShared ? (
                        <Chip size="sm" color="success" variant="flat" className="text-[11px] h-5 shrink-0">
                          {t("todo.share.sent")}
                        </Chip>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isLoading={isSharing}
                          isDisabled={!!sharingRoomId}
                          className="h-7 text-xs shrink-0"
                          onPress={() => handleShareToRoom(room)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("todo.share.sendBtn")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsShareOpen(false)}>
              {t("common.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ─── TodoCard ─────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: TodoItem;
  statuses: ProjectStatus[];
  isDragging: boolean;
  onEdit: (todo: TodoItem) => void;
  onDelete: (id: string) => void;
  onAssign: (todo: TodoItem) => void;
  onStatusChange: (todo: TodoItem, status: string) => void;
  onDragStart: (e: React.DragEvent, todoId: string) => void;
  onDragEnd: () => void;
  formatDueDate: (d: string) => string | null;
  isDueDateOverdue: (d: string) => boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TodoCard({
  todo,
  statuses,
  isDragging,
  onEdit,
  onDelete,
  onAssign,
  onStatusChange,
  onDragStart,
  onDragEnd,
  formatDueDate,
  isDueDateOverdue,
  t,
}: TodoCardProps) {
  const priorityColor = PRIORITY_COLORS[todo.todo_priority] ?? "default";
  const dueDateStr = formatDueDate(todo.todo_dueDate);
  const overdue = isDueDateOverdue(todo.todo_dueDate);
  const assigneeCount = todo.todo_assignees?.length ?? 0;
  const otherStatuses = statuses.filter((s) => s.status_id !== todo.todo_status);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, todo.todo_id)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing transition-all duration-150 rounded-xl ${isDragging ? "opacity-40 scale-95 rotate-1" : "opacity-100"}`}
    >
      <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow select-none" shadow="none">
        <CardBody className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
              {todo.todo_title}
            </p>
            <div draggable onDragStart={(e) => e.stopPropagation()}>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" className="shrink-0 -mt-0.5 -mr-1 text-gray-400" aria-label={t("todo.card.options")}>
                    <EllipsisVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Todo actions"
                  items={[
                    { key: "edit", label: t("todo.card.edit") },
                    { key: "assign", label: t("todo.card.assign") },
                    ...otherStatuses.map((s) => ({
                      key: `status-${s.status_id}`,
                      label: t("todo.card.moveTo", { name: s.status_name }),
                      statusId: s.status_id,
                    })),
                    { key: "delete", label: t("todo.card.delete") },
                  ]}
                >
                  {(item) => {
                    if (item.key === "edit")
                      return (
                        <DropdownItem key="edit" startContent={<PencilIcon className="w-4 h-4" />} onPress={() => onEdit(todo)}>
                          {item.label}
                        </DropdownItem>
                      );
                    if (item.key === "assign")
                      return (
                        <DropdownItem key="assign" startContent={<UserPlusIcon className="w-4 h-4" />} onPress={() => onAssign(todo)}>
                          {item.label}
                        </DropdownItem>
                      );
                    if (item.key === "delete")
                      return (
                        <DropdownItem key="delete" className="text-danger" color="danger" startContent={<TrashIcon className="w-4 h-4" />} onPress={() => onDelete(todo.todo_id)}>
                          {item.label}
                        </DropdownItem>
                      );
                    return (
                      <DropdownItem key={item.key} startContent={<CheckCircleIcon className="w-4 h-4" />} onPress={() => onStatusChange(todo, (item as any).statusId)}>
                        {item.label}
                      </DropdownItem>
                    );
                  }}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          {todo.todo_description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {todo.todo_description}
            </p>
          )}

          <div className="pt-1">
            <Button
              size="sm"
              variant="light"
              className="h-6 px-2 text-[11px] text-primary justify-start"
              startContent={<UserPlusIcon className="w-3.5 h-3.5" />}
              onPress={() => onAssign(todo)}
            >
              {assigneeCount > 0
                ? t("todo.card.reassignBtn", { count: assigneeCount })
                : t("todo.card.assignBtn")}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip size="sm" variant="flat" color={priorityColor} startContent={<FlagIcon className="w-3 h-3" />} className="text-[11px] h-5">
                {t(`todo.priority.${todo.todo_priority}`)}
              </Chip>
              {assigneeCount > 0 && (
                <Chip size="sm" variant="flat" color="secondary" startContent={<UserPlusIcon className="w-3 h-3" />} className="text-[11px] h-5">
                  {assigneeCount}
                </Chip>
              )}
            </div>
            {dueDateStr && (
              <div className={`flex items-center gap-1 text-[11px] ${overdue ? "text-red-500 dark:text-red-400 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
                <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{dueDateStr}</span>
                {overdue && <span className="font-bold">(!)</span>}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
