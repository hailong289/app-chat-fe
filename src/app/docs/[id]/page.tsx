"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useDocSocket } from "@/hooks/useDocSocket";
import { useDocumentSync } from "@/hooks/useDocumentSync";
import useAuthStore from "@/store/useAuthStore";
import { DynamicEditor } from "@/components/docs/DynamicEditor";
import * as Y from "yjs";
import {
  Avatar,
  AvatarGroup,
  Button,
  Chip,
  Tooltip,
  Spinner,
  Card,
  CardBody,
} from "@heroui/react";
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  SignalIcon,
  SignalSlashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params?.id as string;
  const { socket, status } = useDocSocket();
  const currentUser = useAuthStore((s) => s.user);

  // Create Y.Doc instance (stable reference)
  const [ydoc] = useState(() => new Y.Doc());

  // Use centralized document sync hook
  const { document, usersPresence, provider, isRoomJoined, isSnapshotApplied } =
    useDocumentSync({
      docId,
      socket,
      ydoc,
      enabled: status === "connected" && !!currentUser,
    });

  const isLoading = !document || !isSnapshotApplied;
  const activeUsers = Array.from(usersPresence.values());
  const otherUsers = activeUsers.filter((u) => u.userId !== currentUser?._id);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-4">
        <Spinner size="lg" color="primary" />
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">
          {!document ? "Loading document..." : "Syncing editor..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Navbar / Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 transition-all">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Left: Navigation & Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              isIconOnly
              variant="light"
              radius="full"
              onPress={() => router.push("/docs")}
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </Button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
                  {document.title}
                </h1>
                <Chip
                  size="sm"
                  variant="flat"
                  color={status === "connected" ? "success" : "danger"}
                  startContent={
                    status === "connected" ? (
                      <SignalIcon className="w-3 h-3" />
                    ) : (
                      <SignalSlashIcon className="w-3 h-3" />
                    )
                  }
                  className="hidden sm:flex h-6 px-2 gap-1"
                >
                  {status === "connected" ? "Online" : "Offline"}
                </Chip>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                Last edited just now
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-1" />
                {activeUsers.length} active
              </p>
            </div>
          </div>

          {/* Right: Actions & Presence */}
          <div className="flex items-center gap-4">
            {/* Active Users Avatars */}
            <div className="hidden sm:flex items-center">
              <AvatarGroup
                max={4}
                total={activeUsers.length > 4 ? activeUsers.length : undefined}
                size="sm"
                isBordered
              >
                {/* Current User */}
                <Tooltip content="You">
                  <Avatar
                    src={currentUser?.avatar}
                    name={currentUser?.fullname?.[0]}
                    className="ring-2 ring-offset-2 ring-blue-500"
                    color="primary"
                  />
                </Tooltip>

                {/* Other Users */}
                {otherUsers.map((user) => (
                  <Tooltip
                    key={user.userId}
                    content={
                      <div className="px-1 py-0.5">
                        <div className="font-bold text-xs">{user.fullname}</div>
                        {user.isTyping && (
                          <div className="text-[10px] text-blue-400 animate-pulse">
                            Typing...
                          </div>
                        )}
                      </div>
                    }
                  >
                    <Avatar
                      src={user.avatar}
                      name={user.fullname?.[0]}
                      style={{
                        backgroundColor: user.color,
                        borderColor: user.isTyping ? "#3b82f6" : undefined,
                      }}
                      className={
                        user.isTyping
                          ? "animate-pulse ring-2 ring-blue-400"
                          : ""
                      }
                    />
                  </Tooltip>
                ))}
              </AvatarGroup>
            </div>

            {/* Mobile User Count */}
            <div className="sm:hidden flex items-center gap-1 text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-xs font-medium">
              <UserGroupIcon className="w-4 h-4" />
              {activeUsers.length}
            </div>

            <Button
              color="primary"
              variant="solid"
              size="sm"
              className="font-medium shadow-lg shadow-blue-500/20"
              startContent={<CheckCircleIcon className="w-4 h-4" />}
            >
              Share
            </Button>
          </div>
        </div>
      </header>

      {/* Main Editor Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="min-h-[calc(100vh-8rem)] shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardBody className="p-0">
            <div className="editor-wrapper h-full min-h-[500px] p-4 sm:p-8 lg:p-12">
              <DynamicEditor
                key={document._id}
                ydoc={ydoc}
                provider={provider}
                userName={currentUser?.fullname || "Anonymous"}
                userColor={
                  activeUsers.find((u) => u.userId === currentUser?._id)
                    ?.color || "#0066ff"
                }
              />
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
