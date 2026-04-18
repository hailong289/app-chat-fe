"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ClipboardDocumentListIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { format, isPast, parseISO, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import useContactStore from "@/store/useContactStore";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { todoService } from "@/service/todo.service";
import {
  TodoItem,
  TodoStatus,
  TodoPriority,
  CreateTodoPayload,
  UpdateTodoPayload,
} from "@/types/todo.type";
import { ContactType } from "@/store/types/contact.type";

const PRIORITY_CONFIG: Record<
  TodoPriority,
  { label: string; color: "danger" | "warning" | "success" }
> = {
  high: { label: "Cao", color: "danger" },
  medium: { label: "Trung bình", color: "warning" },
  low: { label: "Thấp", color: "success" },
};

const STATUS_CONFIG: Record<
  TodoStatus,
  {
    label: string;
    color: "default" | "primary" | "success" | "danger";
    bgClass: string;
    headerClass: string;
    dropActiveClass: string;
  }
> = {
  todo: {
    label: "Chưa làm",
    color: "default",
    bgClass: "bg-gray-50 dark:bg-gray-900",
    headerClass: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
    dropActiveClass: "ring-2 ring-gray-400 bg-gray-100 dark:bg-gray-800",
  },
  in_progress: {
    label: "Đang làm",
    color: "primary",
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
    headerClass: "bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200",
    dropActiveClass: "ring-2 ring-blue-400 bg-blue-100 dark:bg-blue-900/40",
  },
  done: {
    label: "Hoàn thành",
    color: "success",
    bgClass: "bg-green-50 dark:bg-green-950/20",
    headerClass: "bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200",
    dropActiveClass: "ring-2 ring-green-400 bg-green-100 dark:bg-green-900/40",
  },
  cancelled: {
    label: "Đã huỷ",
    color: "danger",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    headerClass: "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200",
    dropActiveClass: "ring-2 ring-red-400 bg-red-100 dark:bg-red-900/40",
  },
};

const COLUMNS: TodoStatus[] = ["todo", "in_progress", "done", "cancelled"];

const DEFAULT_FORM: CreateTodoPayload & { todo_id?: string } = {
  todo_title: "",
  todo_createdBy: "",
  todo_description: "",
  todo_status: "todo",
  todo_priority: "medium",
  todo_dueDate: "",
};

export default function TodoPage() {
  const getFriends = useContactStore((state) => state.getFriends);
  const storeFriends = useContactStore((state) => state.friends);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>({ ...DEFAULT_FORM });
  const [formAssignees, setFormAssignees] = useState<Set<string>>(new Set());
  const [isLoadingFormFriends, setIsLoadingFormFriends] = useState(false);

  // Drag & Drop state
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TodoStatus | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  // Assign state
  const [assigningTodo, setAssigningTodo] = useState<TodoItem | null>(null);
  const [friends, setFriends] = useState<ContactType[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const friendsLoadedRef = useRef(false);
  const loadingFriendsRef = useRef(false);

  const {
    isOpen: isFormOpen,
    onOpen: onFormOpen,
    onClose: onFormClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const {
    isOpen: isAssignOpen,
    onOpen: onAssignOpen,
    onClose: onAssignClose,
  } = useDisclosure();

  const fetchTodos = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await todoService.listTodos({ page: 1, limit: 100 });
      setTodos(result?.data ?? []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách todo:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const ensureFriendsLoaded = useCallback(async () => {
    if (friendsLoadedRef.current || loadingFriendsRef.current) return;
    loadingFriendsRef.current = true;
    setIsLoadingFormFriends(true);
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
      setIsLoadingFormFriends(false);
      setIsLoadingFriends(false);
    }
  }, [getFriends, storeFriends]);

  /* ─── Form handlers ─── */
  const openCreateModal = (status: TodoStatus = "todo") => {
    void ensureFriendsLoaded();
    setEditingTodo(null);
    setFormAssignees(new Set());
    setForm({ ...DEFAULT_FORM, todo_status: status });
    onFormOpen();
  };

  const openEditModal = (todo: TodoItem) => {
    void ensureFriendsLoaded();
    setEditingTodo(todo);
    setFormAssignees(new Set(todo.todo_assignees ?? []));
    setForm({
      todo_id: todo.todo_id,
      todo_title: todo.todo_title,
      todo_createdBy: todo.todo_createdBy,
      todo_description: todo.todo_description,
      todo_status: todo.todo_status,
      todo_priority: todo.todo_priority,
      todo_dueDate: todo.todo_dueDate ? todo.todo_dueDate.split("T")[0] : "",
    });
    onFormOpen();
  };

  const handleFormClose = () => {
    setEditingTodo(null);
    setForm({ ...DEFAULT_FORM });
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
          todo_dueDate: form.todo_dueDate
            ? new Date(form.todo_dueDate).toISOString()
            : "",
        };
        await todoService.updateTodo(editingTodo.todo_id, payload);
        if (
          !assigneesEqual(assigneeIds, editingTodo.todo_assignees ?? [])
        ) {
          await todoService.assignTodo(editingTodo.todo_id, assigneeIds);
        }
      } else {
        const payload: Omit<CreateTodoPayload, "todo_createdBy"> = {
          todo_title: form.todo_title,
          todo_description: form.todo_description,
          todo_status: form.todo_status,
          todo_priority: form.todo_priority,
          todo_dueDate: form.todo_dueDate
            ? new Date(form.todo_dueDate).toISOString()
            : undefined,
          ...(assigneeIds.length > 0 ? { todo_assignees: assigneeIds } : {}),
        };
        await todoService.createTodo(payload);
      }
      await fetchTodos();
      handleFormClose();
    } catch (error) {
      console.error("Lỗi khi lưu todo:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Delete handlers ─── */
  const handleDeleteClick = (id: string) => {
    setTodoToDelete(id);
    onDeleteOpen();
  };

  const handleConfirmDelete = async () => {
    if (!todoToDelete) return;
    try {
      setIsDeleting(true);
      await todoService.deleteTodo(todoToDelete);
      await fetchTodos();
      onDeleteClose();
      setTodoToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa todo:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  /* ─── Status change ─── */
  const handleStatusChange = async (todo: TodoItem, newStatus: TodoStatus) => {
    try {
      await todoService.updateTodoStatus(todo.todo_id, newStatus);
      await fetchTodos();
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái:", error);
    }
  };

  /* ─── Assign handlers ─── */
  const openAssignModal = async (todo: TodoItem) => {
    void ensureFriendsLoaded();
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
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleConfirmAssign = async () => {
    if (!assigningTodo) return;
    try {
      setIsAssigning(true);
      await todoService.assignTodo(
        assigningTodo.todo_id,
        Array.from(selectedAssignees)
      );
      await fetchTodos();
      handleAssignClose();
    } catch (error) {
      console.error("Lỗi khi gán người dùng:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  /* ─── Drag & Drop handlers ─── */
  const handleDragStart = useCallback(
    (e: React.DragEvent, todoId: string) => {
      e.dataTransfer.setData("todo_id", todoId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingTodoId(todoId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingTodoId(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
  }, []);

  const handleColumnDragEnter = useCallback(
    (e: React.DragEvent, status: TodoStatus) => {
      e.preventDefault();
      dragCounterRef.current[status] =
        (dragCounterRef.current[status] ?? 0) + 1;
      setDragOverColumn(status);
    },
    []
  );

  const handleColumnDragLeave = useCallback(
    (e: React.DragEvent, status: TodoStatus) => {
      dragCounterRef.current[status] =
        (dragCounterRef.current[status] ?? 1) - 1;
      if (dragCounterRef.current[status] <= 0) {
        dragCounterRef.current[status] = 0;
        setDragOverColumn((prev) => (prev === status ? null : prev));
      }
    },
    []
  );

  const handleColumnDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleColumnDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TodoStatus) => {
      e.preventDefault();
      const todoId = e.dataTransfer.getData("todo_id");
      setDragOverColumn(null);
      setDraggingTodoId(null);
      dragCounterRef.current = {};

      if (!todoId) return;
      const todo = todos.find((t) => t.todo_id === todoId);
      if (!todo || todo.todo_status === targetStatus) return;

      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          t.todo_id === todoId ? { ...t, todo_status: targetStatus } : t
        )
      );

      try {
        await todoService.updateTodoStatus(todoId, targetStatus);
      } catch (error) {
        console.error("Lỗi khi kéo thả todo:", error);
        await fetchTodos();
      }
    },
    [todos, fetchTodos]
  );

  /* ─── Helpers ─── */
  const getTodosByStatus = (status: TodoStatus) =>
    todos.filter((t) => t.todo_status === status);

  const formatDueDate = (dueDate: string) => {
    if (!dueDate) return null;
    try {
      const date = parseISO(dueDate);
      if (!isValid(date)) return null;
      return format(date, "dd/MM/yyyy", { locale: vi });
    } catch {
      return null;
    }
  };

  const isDueDateOverdue = (dueDate: string, status: TodoStatus) => {
    if (!dueDate || status === "done" || status === "cancelled") return false;
    try {
      return isPast(parseISO(dueDate));
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ClipboardDocumentListIcon className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Todo
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {todos.length} công việc
            </p>
          </div>
        </div>
        <Button
          color="primary"
          startContent={<PlusIcon className="w-4 h-4" />}
          onPress={() => openCreateModal("todo")}
        >
          Tạo mới
        </Button>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center items-center flex-1 py-16">
          <Spinner size="lg" color="primary" aria-label="Đang tải..." />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4 sm:p-6">
          <div
            className="flex gap-4 h-full min-h-[calc(100vh-120px)]"
            style={{ minWidth: "900px" }}
          >
            {COLUMNS.map((status) => {
              const config = STATUS_CONFIG[status];
              const columnTodos = getTodosByStatus(status);
              const isOver = dragOverColumn === status;

              return (
                <div
                  key={status}
                  onDragEnter={(e) => handleColumnDragEnter(e, status)}
                  onDragLeave={(e) => handleColumnDragLeave(e, status)}
                  onDragOver={handleColumnDragOver}
                  onDrop={(e) => handleColumnDrop(e, status)}
                  className={`
                    flex flex-col flex-1 min-w-[220px] max-w-xs rounded-xl
                    border border-gray-200 dark:border-gray-700
                    transition-all duration-150
                    ${isOver ? config.dropActiveClass : config.bgClass}
                  `}
                >
                  {/* Column Header */}
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${config.headerClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {config.label}
                      </span>
                      <span className="text-xs font-bold bg-white/40 dark:bg-black/20 rounded-full px-2 py-0.5">
                        {columnTodos.length}
                      </span>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="opacity-70 hover:opacity-100"
                      onPress={() => openCreateModal(status)}
                      aria-label={`Thêm vào ${config.label}`}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </Button>
                  </div>

                  <ScrollShadow className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnTodos.length === 0 ? (
                      <div
                        className={`
                          flex items-center justify-center rounded-lg
                          border-2 border-dashed transition-all duration-150
                          text-xs py-8
                          ${
                            isOver
                              ? "border-current opacity-60 scale-[0.98]"
                              : "border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600"
                          }
                        `}
                      >
                        {isOver ? "Thả vào đây" : "Chưa có công việc"}
                      </div>
                    ) : (
                      columnTodos.map((todo) => (
                        <TodoCard
                          key={todo.todo_id}
                          todo={todo}
                          isDragging={draggingTodoId === todo.todo_id}
                          onEdit={openEditModal}
                          onDelete={handleDeleteClick}
                          onStatusChange={handleStatusChange}
                          onAssign={openAssignModal}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          formatDueDate={formatDueDate}
                          isDueDateOverdue={isDueDateOverdue}
                        />
                      ))
                    )}
                  </ScrollShadow>

                  {/* Add Button (footer) */}
                  <div className="p-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <Button
                      variant="light"
                      size="sm"
                      className="w-full text-gray-500 dark:text-gray-400 justify-start gap-2 hover:bg-white/50 dark:hover:bg-white/5"
                      startContent={<PlusIcon className="w-4 h-4" />}
                      onPress={() => openCreateModal(status)}
                    >
                      Thêm công việc
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        size="md"
        placement="center"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="text-lg font-semibold">
            {editingTodo ? "Chỉnh sửa công việc" : "Tạo công việc mới"}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="Tiêu đề"
              placeholder="Nhập tiêu đề công việc..."
              value={form.todo_title}
              onValueChange={(v) => setForm((f) => ({ ...f, todo_title: v }))}
              isRequired
              variant="bordered"
            />
            <Textarea
              label="Mô tả"
              placeholder="Mô tả công việc (tuỳ chọn)..."
              value={form.todo_description ?? ""}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, todo_description: v }))
              }
              variant="bordered"
              minRows={2}
              maxRows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Trạng thái"
                selectedKeys={form.todo_status ? [form.todo_status] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as TodoStatus;
                  setForm((f) => ({ ...f, todo_status: val }));
                }}
                variant="bordered"
              >
                {COLUMNS.map((s) => (
                  <SelectItem key={s} textValue={STATUS_CONFIG[s].label}>
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Ưu tiên"
                selectedKeys={form.todo_priority ? [form.todo_priority] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as TodoPriority;
                  setForm((f) => ({ ...f, todo_priority: val }));
                }}
                variant="bordered"
              >
                {(["high", "medium", "low"] as TodoPriority[]).map((p) => (
                  <SelectItem key={p} textValue={PRIORITY_CONFIG[p].label}>
                    {PRIORITY_CONFIG[p].label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label="Ngày hết hạn"
              type="date"
              value={form.todo_dueDate ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, todo_dueDate: v }))}
              variant="bordered"
              placeholder="Chọn ngày hết hạn"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Gán cho
              </label>
              <p className="text-xs text-default-500 -mt-1">
                Chọn bạn bè được giao việc (tuỳ chọn). Có thể chọn nhiều người.
              </p>
              {isLoadingFormFriends ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" color="primary" />
                </div>
              ) : friends.length === 0 ? (
                <p className="text-xs text-default-400 text-center py-2">
                  Chưa có bạn bè
                </p>
              ) : (
                <Select
                  aria-label="Gán công việc cho bạn bè"
                  selectionMode="multiple"
                  placeholder="Chọn người thực hiện..."
                  selectedKeys={formAssignees}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    setFormAssignees(new Set(Array.from(keys as Set<string>)));
                  }}
                  variant="bordered"
                  classNames={{
                    trigger: "min-h-12",
                    value: "text-small",
                  }}
                  renderValue={(items) => {
                    if (items.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {items.map((item) => (
                          <Chip
                            key={item.key}
                            size="sm"
                            variant="flat"
                            color="primary"
                            classNames={{ content: "text-tiny" }}
                          >
                            {item.textValue}
                          </Chip>
                        ))}
                      </div>
                    );
                  }}
                >
                  {friends.map((f) => (
                    <SelectItem
                      key={f._id}
                      textValue={f.fullname}
                      startContent={
                        <Avatar
                          className="w-6 h-6"
                          src={f.avatar ?? undefined}
                          name={f.fullname}
                          size="sm"
                        />
                      }
                    >
                      {f.fullname}
                    </SelectItem>
                  ))}
                </Select>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleFormClose}>
              Huỷ
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isLoading={isSubmitting}
              isDisabled={!form.todo_title.trim()}
            >
              {editingTodo ? "Lưu thay đổi" : "Tạo mới"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={handleAssignClose}
        size="sm"
        placement="center"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-base font-semibold">Gán công việc</span>
            {assigningTodo && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 line-clamp-1">
                {assigningTodo.todo_title}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="pb-2">
            {isLoadingFriends ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" color="primary" />
              </div>
            ) : friends.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                Chưa có bạn bè
              </p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {friends.map((friend) => {
                  const isSelected = selectedAssignees.has(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleAssignee(friend.id)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                        transition-colors duration-100
                        ${
                          isSelected
                            ? "bg-primary/10 dark:bg-primary/20"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }
                      `}
                    >
                      <Avatar
                        src={friend.avatar ?? undefined}
                        name={friend.fullname}
                        size="sm"
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                        {friend.fullname}
                      </span>
                      <Checkbox
                        isSelected={isSelected}
                        color="primary"
                        size="sm"
                        onChange={() => toggleAssignee(friend.id)}
                        aria-label={`Chọn ${friend.fullname}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {selectedAssignees.size > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 self-center">
                  Đã chọn:
                </span>
                {Array.from(selectedAssignees).map((id) => {
                  const f = friends.find((x) => x.id === id);
                  if (!f) return null;
                  return (
                    <Chip
                      key={id}
                      size="sm"
                      variant="flat"
                      color="primary"
                      avatar={
                        <Avatar
                          src={f.avatar ?? undefined}
                          name={f.fullname}
                          size="sm"
                        />
                      }
                      onClose={() => toggleAssignee(id)}
                    >
                      {f.fullname}
                    </Chip>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleAssignClose}>
              Huỷ
            </Button>
            <Button
              color="primary"
              onPress={handleConfirmAssign}
              isLoading={isAssigning}
            >
              Xác nhận ({selectedAssignees.size})
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleConfirmDelete}
        title="Xóa công việc"
        content="Bạn có chắc chắn muốn xóa công việc này không? Thao tác này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Huỷ"
        color="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

/* ─── TodoCard component ─── */
interface TodoCardProps {
  todo: TodoItem;
  isDragging: boolean;
  onEdit: (todo: TodoItem) => void;
  onDelete: (id: string) => void;
  onAssign: (todo: TodoItem) => void;
  onStatusChange: (todo: TodoItem, status: TodoStatus) => void;
  onDragStart: (e: React.DragEvent, todoId: string) => void;
  onDragEnd: () => void;
  formatDueDate: (d: string) => string | null;
  isDueDateOverdue: (d: string, s: TodoStatus) => boolean;
}

function TodoCard({
  todo,
  isDragging,
  onEdit,
  onDelete,
  onAssign,
  onStatusChange,
  onDragStart,
  onDragEnd,
  formatDueDate,
  isDueDateOverdue,
}: TodoCardProps) {
  const priority = PRIORITY_CONFIG[todo.todo_priority];
  const dueDateStr = formatDueDate(todo.todo_dueDate);
  const overdue = isDueDateOverdue(todo.todo_dueDate, todo.todo_status);
  const isDone = todo.todo_status === "done";
  const assigneeCount = todo.todo_assignees?.length ?? 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, todo.todo_id)}
      onDragEnd={onDragEnd}
      className={`
        cursor-grab active:cursor-grabbing
        transition-all duration-150 rounded-xl
        ${isDragging ? "opacity-40 scale-95 rotate-1" : "opacity-100"}
      `}
    >
      <Card
        className={`
          border border-gray-200 dark:border-gray-700
          hover:shadow-md transition-shadow select-none
          ${isDone ? "opacity-60" : ""}
        `}
        shadow="none"
      >
        <CardBody className="p-3 space-y-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-1">
            <p
              className={`text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1 ${
                isDone ? "line-through" : ""
              }`}
            >
              {todo.todo_title}
            </p>
            {/* Stop drag propagation so dropdown still works */}
            <div draggable onDragStart={(e) => e.stopPropagation()}>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="shrink-0 -mt-0.5 -mr-1 text-gray-400"
                    aria-label="Tuỳ chọn"
                  >
                    <EllipsisVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Todo actions">
                  <DropdownItem
                    key="edit"
                    startContent={<PencilIcon className="w-4 h-4" />}
                    onPress={() => onEdit(todo)}
                  >
                    Chỉnh sửa
                  </DropdownItem>
                  <DropdownItem
                    key="assign"
                    startContent={<UserPlusIcon className="w-4 h-4" />}
                    onPress={() => onAssign(todo)}
                  >
                    Gán người dùng
                  </DropdownItem>
                  {todo.todo_status !== "todo" ? (
                    <DropdownItem
                      key="status-todo"
                      startContent={<CheckCircleIcon className="w-4 h-4" />}
                      onPress={() => onStatusChange(todo, "todo")}
                    >
                      Chuyển sang: {STATUS_CONFIG.todo.label}
                    </DropdownItem>
                  ) : null}
                  {todo.todo_status !== "in_progress" ? (
                    <DropdownItem
                      key="status-in_progress"
                      startContent={<CheckCircleIcon className="w-4 h-4" />}
                      onPress={() => onStatusChange(todo, "in_progress")}
                    >
                      Chuyển sang: {STATUS_CONFIG.in_progress.label}
                    </DropdownItem>
                  ) : null}
                  {todo.todo_status !== "done" ? (
                    <DropdownItem
                      key="status-done"
                      startContent={<CheckCircleIcon className="w-4 h-4" />}
                      onPress={() => onStatusChange(todo, "done")}
                    >
                      Chuyển sang: {STATUS_CONFIG.done.label}
                    </DropdownItem>
                  ) : null}
                  {todo.todo_status !== "cancelled" ? (
                    <DropdownItem
                      key="status-cancelled"
                      startContent={<CheckCircleIcon className="w-4 h-4" />}
                      onPress={() => onStatusChange(todo, "cancelled")}
                    >
                      Chuyển sang: {STATUS_CONFIG.cancelled.label}
                    </DropdownItem>
                  ) : null}
                  <DropdownItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    startContent={<TrashIcon className="w-4 h-4" />}
                    onPress={() => onDelete(todo.todo_id)}
                  >
                    Xóa
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          {/* Description */}
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
              {assigneeCount > 0 ? `Gán lại (${assigneeCount})` : "Gán người"}
            </Button>
          </div>

          {/* Footer: priority + due date + assignees */}
          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip
                size="sm"
                variant="flat"
                color={priority.color}
                startContent={<FlagIcon className="w-3 h-3" />}
                className="text-[11px] h-5"
              >
                {priority.label}
              </Chip>

              {assigneeCount > 0 && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<UserPlusIcon className="w-3 h-3" />}
                  className="text-[11px] h-5"
                >
                  {assigneeCount}
                </Chip>
              )}
            </div>

            {dueDateStr && (
              <div
                className={`flex items-center gap-1 text-[11px] ${
                  overdue
                    ? "text-red-500 dark:text-red-400 font-semibold"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
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
