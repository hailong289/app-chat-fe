"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  CardBody,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Divider,
  Tooltip,
} from "@heroui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  FolderOpenIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SwatchIcon,
} from "@heroicons/react/24/outline";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { todoService } from "@/service/todo.service";
import { toast } from "@/store/useToastStore";
import useTodoStore from "@/store/useTodoStore";
import {
  TodoProject,
  ProjectStatus,
  CreateProjectPayload,
  UpdateProjectPayload,
  CreateProjectStatusPayload,
} from "@/types/todo.type";

// ─── Color palette ────────────────────────────────────────────────────────────

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

function getColorClass(color?: string) {
  return STATUS_COLOR_OPTIONS.find((c) => c.value === color)?.class ?? "bg-gray-400";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { projects, isLoadingProjects, fetchProjects, upsertProject, removeProject } =
    useTodoStore();

  // "context" project — which project a status action is targeting
  const [contextProject, setContextProject] = useState<TodoProject | null>(null);

  // Project form
  const [projectForm, setProjectForm] = useState<CreateProjectPayload>({
    project_name: "",
    project_description: "",
  });
  const [editingProject, setEditingProject] = useState<TodoProject | null>(null);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Status form
  const [statusForm, setStatusForm] = useState<CreateProjectStatusPayload>({
    status_name: "",
    status_color: "gray",
  });
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);
  const [isDeletingStatus, setIsDeletingStatus] = useState(false);

  const {
    isOpen: isProjectFormOpen,
    onOpen: onProjectFormOpen,
    onClose: onProjectFormClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteProjectOpen,
    onOpen: onDeleteProjectOpen,
    onClose: onDeleteProjectClose,
  } = useDisclosure();
  const {
    isOpen: isStatusFormOpen,
    onOpen: onStatusFormOpen,
    onClose: onStatusFormClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteStatusOpen,
    onOpen: onDeleteStatusOpen,
    onClose: onDeleteStatusClose,
  } = useDisclosure();

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Keep contextProject fresh after any store update
  useEffect(() => {
    if (contextProject) {
      const updated = projects.find((p) => p.project_id === contextProject.project_id);
      setContextProject(updated ?? null);
    }
  }, [projects, contextProject]);

  const extractErrorMessage = useCallback(
    (err: unknown): string => {
      if (!err || typeof err !== "object") return t("todo.error.generic");
      const e = err as any;
      const raw: string = e?.message ?? e?.error ?? "";
      if (raw.includes("Project not found")) return t("todo.projects.error.projectNotFound");
      if (raw.includes("Status already exists")) return t("todo.projects.error.statusExists");
      return raw || t("todo.error.generic");
    },
    [t]
  );

  // ── Project CRUD ─────────────────────────────────────────────────────────────

  const openCreateProject = () => {
    setEditingProject(null);
    setProjectForm({ project_name: "", project_description: "" });
    onProjectFormOpen();
  };

  const openEditProject = (project: TodoProject) => {
    setEditingProject(project);
    setProjectForm({
      project_name: project.project_name,
      project_description: project.project_description ?? "",
    });
    onProjectFormOpen();
  };

  const handleSubmitProject = async () => {
    if (!projectForm.project_name.trim()) return;
    try {
      setIsSubmittingProject(true);
      let saved: TodoProject;
      if (editingProject) {
        const payload: UpdateProjectPayload = {
          project_name: projectForm.project_name,
          project_description: projectForm.project_description,
        };
        saved = await todoService.updateProject(editingProject.project_id, payload);
      } else {
        saved = await todoService.createProject(projectForm);
      }
      upsertProject(saved);
      onProjectFormClose();
      toast.success(
        editingProject
          ? t("todo.projects.toast.updated")
          : t("todo.projects.toast.created")
      );
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProjectId) return;
    try {
      setIsDeletingProject(true);
      await todoService.deleteProject(deletingProjectId);
      removeProject(deletingProjectId);
      onDeleteProjectClose();
      toast.success(t("todo.projects.toast.deleted"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsDeletingProject(false);
    }
  };

  // ── Status CRUD ───────────────────────────────────────────────────────────────

  const openAddStatus = (project: TodoProject) => {
    setContextProject(project);
    setEditingStatus(null);
    setStatusForm({ status_name: "", status_color: "gray" });
    onStatusFormOpen();
  };

  const openEditStatus = (project: TodoProject, status: ProjectStatus) => {
    setContextProject(project);
    setEditingStatus(status);
    setStatusForm({
      status_name: status.status_name,
      status_color: status.status_color ?? "gray",
    });
    onStatusFormOpen();
  };

  const handleSubmitStatus = async () => {
    if (!contextProject || !statusForm.status_name.trim()) return;
    try {
      setIsSubmittingStatus(true);
      let updatedProject: TodoProject;
      if (editingStatus) {
        updatedProject = await todoService.updateProjectStatus(
          contextProject.project_id,
          editingStatus.status_id,
          { status_name: statusForm.status_name, status_color: statusForm.status_color }
        );
      } else {
        updatedProject = await todoService.addProjectStatus(contextProject.project_id, statusForm);
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
    if (!contextProject || !deletingStatusId) return;
    try {
      setIsDeletingStatus(true);
      const updatedProject = await todoService.deleteProjectStatus(
        contextProject.project_id,
        deletingStatusId
      );
      upsertProject(updatedProject);
      onDeleteStatusClose();
      toast.success(t("todo.projects.status.toast.deleted"));
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    } finally {
      setIsDeletingStatus(false);
    }
  };

  const handleReorderStatus = async (
    project: TodoProject,
    status: ProjectStatus,
    direction: "up" | "down"
  ) => {
    const sorted = [...project.project_statuses].sort(
      (a, b) => a.status_order - b.status_order
    );
    const idx = sorted.findIndex((s) => s.status_id === status.status_id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const newOrder =
      direction === "up"
        ? sorted[targetIdx].status_order - 0.5
        : sorted[targetIdx].status_order + 0.5;
    try {
      const updatedProject = await todoService.updateProjectStatus(
        project.project_id,
        status.status_id,
        { status_order: newOrder }
      );
      upsertProject(updatedProject);
    } catch (err) {
      toast.error(extractErrorMessage(err), t("todo.toast.error"));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <Button
          as={Link}
          href="/todo"
          isIconOnly
          variant="light"
          size="sm"
          aria-label={t("todo.projects.backToTodo")}
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <FolderOpenIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t("todo.projects.title")}
          </h1>
          <p className="text-xs text-gray-500">
            {t("todo.projects.count", { count: projects.length })}
          </p>
        </div>
        <div className="ml-auto">
          <Button
            color="primary"
            size="sm"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={openCreateProject}
          >
            {t("todo.projects.create")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingProjects ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" color="primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderOpenIcon className="w-8 h-8 text-primary" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
              {t("todo.projects.noProjects")}
            </p>
            <Button
              color="primary"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={openCreateProject}
            >
              {t("todo.projects.create")}
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {projects.map((project) => {
              const sortedStatuses = [...project.project_statuses].sort(
                (a, b) => a.status_order - b.status_order
              );

              return (
                <Card
                  key={project.project_id}
                  shadow="none"
                  className="border border-gray-200 dark:border-gray-700"
                >
                  <CardBody className="p-0">
                    {/* Project header row */}
                    <div className="flex items-start gap-3 px-5 pt-5 pb-4">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                        <FolderOpenIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {project.project_name}
                        </h2>
                        {project.project_description ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {project.project_description}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic mt-0.5">
                            {t("todo.projectList.noDescription")}
                          </p>
                        )}
                      </div>
                      {/* Project actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip content={t("common.edit")} size="sm">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => openEditProject(project)}
                            aria-label={t("common.edit")}
                          >
                            <PencilIcon className="w-4 h-4 text-gray-400" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={t("common.delete")} color="danger" size="sm">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => {
                              setDeletingProjectId(project.project_id);
                              onDeleteProjectOpen();
                            }}
                            aria-label={t("common.delete")}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>

                    <Divider />

                    {/* Status section */}
                    <div className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {t("todo.projects.status.sectionTitle", {
                            count: sortedStatuses.length,
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<PlusIcon className="w-3.5 h-3.5" />}
                          onPress={() => openAddStatus(project)}
                          className="h-7 text-xs"
                        >
                          {t("todo.projects.status.add")}
                        </Button>
                      </div>

                      {sortedStatuses.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {t("todo.projects.status.noStatuses")}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {sortedStatuses.map((status, idx) => (
                            <div
                              key={status.status_id}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColorClass(status.status_color)}`}
                              />
                              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {status.status_name}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Tooltip content={t("todo.projects.status.moveUp")} size="sm">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    isDisabled={idx === 0}
                                    onPress={() => handleReorderStatus(project, status, "up")}
                                    aria-label={t("todo.projects.status.moveUp")}
                                    className="w-7 h-7 min-w-0"
                                  >
                                    <ArrowUpIcon className="w-3.5 h-3.5" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content={t("todo.projects.status.moveDown")} size="sm">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    isDisabled={idx === sortedStatuses.length - 1}
                                    onPress={() => handleReorderStatus(project, status, "down")}
                                    aria-label={t("todo.projects.status.moveDown")}
                                    className="w-7 h-7 min-w-0"
                                  >
                                    <ArrowDownIcon className="w-3.5 h-3.5" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content={t("todo.projects.status.edit")} size="sm">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    onPress={() => openEditStatus(project, status)}
                                    aria-label={t("todo.projects.status.edit")}
                                    className="w-7 h-7 min-w-0"
                                  >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                  </Button>
                                </Tooltip>
                                <Tooltip
                                  content={
                                    sortedStatuses.length <= 1
                                      ? t("todo.projects.status.deleteDisabled")
                                      : t("todo.projects.status.delete")
                                  }
                                  color={sortedStatuses.length <= 1 ? "default" : "danger"}
                                  size="sm"
                                >
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    isDisabled={sortedStatuses.length <= 1}
                                    onPress={() => {
                                      setContextProject(project);
                                      setDeletingStatusId(status.status_id);
                                      onDeleteStatusOpen();
                                    }}
                                    aria-label={t("todo.projects.status.delete")}
                                    className="w-7 h-7 min-w-0"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </Button>
                                </Tooltip>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Project create/edit modal */}
      <Modal isOpen={isProjectFormOpen} onClose={onProjectFormClose} size="sm" placement="center">
        <ModalContent>
          <ModalHeader>
            {editingProject
              ? t("todo.projects.form.editTitle")
              : t("todo.projects.form.createTitle")}
          </ModalHeader>
          <ModalBody className="gap-3">
            <Input
              label={t("todo.projects.form.nameLabel")}
              placeholder={t("todo.projects.form.namePlaceholder")}
              value={projectForm.project_name}
              onValueChange={(v) => setProjectForm((f) => ({ ...f, project_name: v }))}
              isRequired
              variant="bordered"
            />
            <Textarea
              label={t("todo.projects.form.descLabel")}
              placeholder={t("todo.projects.form.descPlaceholder")}
              value={projectForm.project_description ?? ""}
              onValueChange={(v) => setProjectForm((f) => ({ ...f, project_description: v }))}
              variant="bordered"
              minRows={2}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onProjectFormClose}>
              {t("todo.projects.form.cancel")}
            </Button>
            <Button
              color="primary"
              onPress={handleSubmitProject}
              isLoading={isSubmittingProject}
              isDisabled={!projectForm.project_name.trim()}
            >
              {editingProject
                ? t("todo.projects.form.save")
                : t("todo.projects.form.create")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Status create/edit modal */}
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
                      ${
                        statusForm.status_color === c.value
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-105"
                      }
                    `}
                    aria-label={t(`todo.projects.status.colors.${c.value}`)}
                    title={t(`todo.projects.status.colors.${c.value}`)}
                  />
                ))}
              </div>
              {statusForm.status_color && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-3 h-3 rounded-full ${getColorClass(statusForm.status_color)}`} />
                  <span className="text-xs text-gray-500">
                    {t(`todo.projects.status.colors.${statusForm.status_color}`)}
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

      {/* Delete project confirm */}
      <ConfirmModal
        isOpen={isDeleteProjectOpen}
        onClose={onDeleteProjectClose}
        onConfirm={handleDeleteProject}
        title={t("todo.projects.delete.title")}
        content={t("todo.projects.delete.content")}
        confirmText={t("todo.projects.delete.confirm")}
        cancelText={t("todo.projects.delete.cancel")}
        color="danger"
        isLoading={isDeletingProject}
      />

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
    </div>
  );
}
