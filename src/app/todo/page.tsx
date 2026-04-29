"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useAuthStore from "@/store/useAuthStore";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
} from "@heroui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  FolderOpenIcon,
  ArrowRightIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { todoService } from "@/service/todo.service";
import { toast } from "@/store/useToastStore";
import useTodoStore from "@/store/useTodoStore";
import {
  TodoProject,
  CreateProjectPayload,
  UpdateProjectPayload,
  isProjectCreator,
} from "@/types/todo.type";

// ─── Badge palette (matches kanban STATUS_PALETTE) ───────────────────────────

const BADGE_COLORS = [
  "default",
  "primary",
  "success",
  "warning",
  "danger",
  "secondary",
] as const;

function getBadgeColor(index: number) {
  return BADGE_COLORS[index % BADGE_COLORS.length];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodoPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?._id ?? s.user?.id ?? "");
  const { projects, isLoadingProjects, fetchProjects, upsertProject, removeProject } =
    useTodoStore();

  // Project form
  const [projectForm, setProjectForm] = useState<CreateProjectPayload>({
    project_name: "",
    project_description: "",
  });
  const [editingProject, setEditingProject] = useState<TodoProject | null>(null);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

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

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const extractErrorMessage = useCallback(
    (err: unknown): string => {
      if (!err || typeof err !== "object") return t("todo.error.generic");
      const e = err as any;
      const raw: string = e?.message ?? e?.error ?? "";
      if (raw.includes("Project not found")) return t("todo.projects.error.projectNotFound");
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
    if (!isProjectCreator(project, currentUserId)) {
      toast.error(t("todo.projects.error.onlyCreator"));
      return;
    }
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
    const targetProject = projects.find((p) => p.project_id === deletingProjectId);
    if (!targetProject || !isProjectCreator(targetProject, currentUserId)) {
      toast.error(t("todo.projects.error.onlyCreator"));
      onDeleteProjectClose();
      return;
    }
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <ClipboardDocumentListIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t("todo.title")}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("todo.projectList.subtitle")}
          </p>
        </div>
        <div className="ml-auto">
          <Button
            color="primary"
            size="sm"
            startContent={<PlusIcon className="w-4 h-4" />}
            onPress={openCreateProject}
          >
            {t("todo.projectList.createProject")}
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
              {t("todo.projectList.noProjects")}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("todo.projectList.noProjectsDesc")}
            </p>
            <Button
              color="primary"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={openCreateProject}
            >
              {t("todo.projectList.createProject")}
            </Button>
          </div>
        ) : (
          /* Multi-column grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => {
              const sortedStatuses = [...project.project_statuses].sort(
                (a, b) => a.status_order - b.status_order
              );

              return (
                <Card
                  key={project.project_id}
                  isPressable
                  onPress={() => router.push(`/todo/${project.project_id}`)}
                  shadow="none"
                  className="border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
                >
                  <CardBody className="p-4 flex flex-col gap-3">
                    {/* Card header */}
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <FolderOpenIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate leading-snug">
                          {project.project_name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 min-h-[32px]">
                          {project.project_description || t("todo.projectList.noDescription")}
                        </p>
                      </div>
                      {/* Actions — show on hover */}
                      {isProjectCreator(project, currentUserId) && (
                        <div
                          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="w-7 h-7 min-w-0"
                            onPress={() => openEditProject(project)}
                            aria-label={t("common.edit")}
                          >
                            <PencilIcon className="w-3.5 h-3.5 text-gray-400" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            className="w-7 h-7 min-w-0"
                            onPress={(e) => {
                              (e as any)?.stopPropagation?.();
                              setDeletingProjectId(project.project_id);
                              onDeleteProjectOpen();
                            }}
                            aria-label={t("common.delete")}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Owner / Member badge */}
                    <div className="flex items-center gap-1.5 -mt-1">
                      {isProjectCreator(project, currentUserId) ? (
                        <Chip size="sm" variant="flat" color="primary" className="text-[11px] h-5">
                          {t("todo.projects.members.ownerBadge")}
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color="secondary" className="text-[11px] h-5">
                          {t("todo.projects.members.memberBadge")}
                        </Chip>
                      )}
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {t("todo.projects.members.count", { count: project.project_members?.length ?? 0 })}
                      </span>
                    </div>

                    {/* Status badges */}
                    {sortedStatuses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sortedStatuses.slice(0, 5).map((s, idx) => (
                          <Chip
                            key={s.status_id}
                            size="sm"
                            variant="flat"
                            color={getBadgeColor(idx)}
                            className="text-[11px] h-5 cursor-default"
                          >
                            {s.status_name}
                          </Chip>
                        ))}
                        {sortedStatuses.length > 5 && (
                          <Chip
                            size="sm"
                            variant="flat"
                            color="default"
                            className="text-[11px] h-5 cursor-default"
                          >
                            +{sortedStatuses.length - 5}
                          </Chip>
                        )}
                      </div>
                    )}

                    {/* Open board link */}
                    <div className="flex justify-end mt-auto pt-1">
                      <span className="text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("todo.projectList.viewBoard")}
                        <ArrowRightIcon className="w-3 h-3" />
                      </span>
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
    </div>
  );
}
