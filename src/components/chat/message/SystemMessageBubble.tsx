"use client";

import {
  UserPlusIcon,
  UserMinusIcon,
  UserCircleIcon,
  PencilSquareIcon,
  PhotoIcon,
  PhoneIcon,
  VideoCameraIcon,
  PhoneXMarkIcon,
  StarIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import type { ComponentType, ReactNode } from "react";
import {
  MessageType,
  RoomEventActor,
  RoomEventType,
} from "@/store/types/message.state";

interface SystemMessageBubbleProps {
  msg: MessageType;
}

type IconCmp = ComponentType<{ className?: string }>;

/** Map event_type → icon. Falls back to ✨ for unknown. */
function pickIcon(eventType: RoomEventType["event_type"] | undefined): IconCmp {
  switch (eventType) {
    case "member.added":
    case "member.joined":
    case "member.create":
      return UserPlusIcon;
    case "member.left":
    case "member.deleted":
      return UserMinusIcon;
    case "member.change.role":
      return StarIcon;
    case "member.change.name":
      return PencilSquareIcon;
    case "member.change.avatar":
      return PhotoIcon;
    case "member.change.nickName":
      return UserCircleIcon;
    case "call.started":
    case "call.joined":
      return PhoneIcon;
    case "call.left":
    case "call.ended":
      return PhoneXMarkIcon;
    default:
      return SparklesIcon;
  }
}

/** Tailwind tone per event family (subtle accent — Messenger style stays neutral). */
function pickAccent(eventType: RoomEventType["event_type"] | undefined) {
  if (!eventType) return "text-gray-500";
  if (eventType.startsWith("call.")) return "text-emerald-600";
  if (eventType.startsWith("member.change.")) return "text-amber-600";
  if (eventType === "member.added" || eventType === "member.joined")
    return "text-blue-600";
  if (eventType === "member.left" || eventType === "member.deleted")
    return "text-rose-600";
  return "text-gray-500";
}

function pickIconForCall(payload: Record<string, unknown> | undefined) {
  const callType = (payload?.callType as string | undefined) ?? "audio";
  return callType === "video" ? VideoCameraIcon : PhoneIcon;
}

/**
 * Build the rendered fragments. We try the rich version first (using actor +
 * targets to bold names); if room_event is missing, fall back to placeholder
 * text so older messages still render.
 */
function buildFragments(
  msg: MessageType,
): { actor?: RoomEventActor | null; segments: Array<ReactNode | string> } {
  const ev = msg.room_event;
  if (!ev) {
    return {
      actor: null,
      segments: [msg.placeholder || msg.content || ""],
    };
  }

  const actor = ev.actor;
  const targets = ev.targets ?? [];
  const actorName = actor?.fullname ?? "Ai đó";

  const bold = (text: string, key: string) => (
    <span key={key} className="font-semibold text-foreground">
      {text}
    </span>
  );

  switch (ev.event_type) {
    case "member.added": {
      const names = targets.map((t) => t.fullname).join(", ");
      return {
        actor,
        segments: [
          bold(actorName, "actor"),
          " đã thêm ",
          bold(names || "thành viên", "targets"),
          " vào nhóm",
        ],
      };
    }
    case "member.deleted": {
      const names = targets.map((t) => t.fullname).join(", ");
      return {
        actor,
        segments: [
          bold(actorName, "actor"),
          " đã xoá ",
          bold(names || "thành viên", "targets"),
          " khỏi nhóm",
        ],
      };
    }
    case "member.left":
      return {
        actor,
        segments: [bold(actorName, "actor"), " đã rời khỏi nhóm"],
      };
    case "member.joined":
      return {
        actor,
        segments: [bold(actorName, "actor"), " đã tham gia nhóm"],
      };
    case "member.change.role":
      return {
        actor,
        segments: [
          bold(actorName, "actor"),
          " đã cập nhật quyền của ",
          bold(targets[0]?.fullname ?? "thành viên", "target"),
        ],
      };
    case "member.change.name": {
      const newName =
        (ev.payload?.name as string | undefined) ??
        (ev.payload?.new_name as string | undefined);
      return {
        actor,
        segments: newName
          ? [
              bold(actorName, "actor"),
              " đã đổi tên nhóm thành ",
              bold(`"${newName}"`, "name"),
            ]
          : [bold(actorName, "actor"), " đã đổi tên nhóm"],
      };
    }
    case "member.change.avatar":
      return {
        actor,
        segments: [bold(actorName, "actor"), " đã cập nhật ảnh đại diện nhóm"],
      };
    case "member.change.nickName": {
      const target = targets[0]?.fullname ?? "thành viên";
      const newNick = ev.payload?.new_name as string | undefined;
      return {
        actor,
        segments: newNick
          ? [
              bold(actorName, "actor"),
              " đã đổi biệt danh của ",
              bold(target, "target"),
              " thành ",
              bold(`"${newNick}"`, "nick"),
            ]
          : [
              bold(actorName, "actor"),
              " đã đổi biệt danh của ",
              bold(target, "target"),
            ],
      };
    }
    case "call.started": {
      const callType =
        (ev.payload?.callType as string | undefined) === "video"
          ? "video"
          : "thoại";
      return {
        actor,
        segments: [
          bold(actorName, "actor"),
          ` đã bắt đầu cuộc gọi ${callType} nhóm`,
        ],
      };
    }
    case "call.joined":
      return {
        actor,
        segments: [bold(actorName, "actor"), " đã tham gia cuộc gọi"],
      };
    case "call.left":
      return {
        actor,
        segments: [bold(actorName, "actor"), " đã rời cuộc gọi"],
      };
    case "call.ended":
      // ev.placeholder already includes duration ("Cuộc gọi đã kết thúc · 5 phút 32 giây")
      return { actor, segments: [ev.placeholder] };
    default:
      return { actor, segments: [ev.placeholder || msg.placeholder || ""] };
  }
}

export function SystemMessageBubble({ msg }: Readonly<SystemMessageBubbleProps>) {
  const ev = msg.room_event;
  const Icon =
    ev?.event_type === "call.started"
      ? pickIconForCall(ev.payload as Record<string, unknown> | undefined)
      : pickIcon(ev?.event_type);
  const accent = pickAccent(ev?.event_type);
  const { segments } = buildFragments(msg);

  return (
    <div className="my-2 flex w-full justify-center">
      <div className="flex max-w-[85%] items-center gap-2 rounded-full bg-default-100/80 px-3 py-1 text-xs text-gray-600 backdrop-blur-sm">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent}`} />
        <span className="text-center leading-relaxed">{segments}</span>
      </div>
    </div>
  );
}
