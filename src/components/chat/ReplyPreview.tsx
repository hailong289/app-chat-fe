import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";

interface ReplyPreviewProps {
  reply: any;
  onJump: (id: string) => void;
}

export function ReplyPreview({ reply, onJump }: ReplyPreviewProps) {
  if (!reply) return null;

  // Field mapping:
  // - reply.isDeleted (or reply.status === 'recalled') => message was recalled (thu hồi)
  // - reply.hiddenByMe => message was deleted by me (xoá)
  const isRecalled = !!reply.isDeleted || reply.status === "recalled";
  const isDeleted = !!reply.hiddenByMe;

  const badge =
    reply.type !== "text" && !isDeleted && !isRecalled ? (
      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
        {reply.type === "image" && "📷 Ảnh"}
        {reply.type === "video" && "🎥 Video"}
        {reply.type === "file" && "📎 File"}
        {reply.type === "gif" && "🎬 GIF"}
      </span>
    ) : null;

  let previewText: string;
  if (isDeleted) {
    // Deleted by me
    previewText = "Tin nhắn đã bị xoá";
  } else if (isRecalled) {
    // Recalled (thu hồi)
    if (reply.isMine) {
      previewText = "Bạn đã thu hồi tin nhắn này";
    } else {
      previewText = "Tin nhắn đã bị thu hồi";
    }
  } else if (reply.type === "text") {
    previewText = reply.content;
  } else {
    previewText = reply.attachments?.[0]?.name || "File đính kèm";
  }

  return (
    <button
      onClick={() => onJump(reply._id)}
      className={`mb-2 px-3 py-2 rounded-lg max-w-sm border-l-4 bg-gradient-to-r cursor-pointer transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-2 mb-1">
        <ArrowUturnLeftIcon className="h-3 w-3 text-teal-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-teal-600">
          {reply.isMine ? "Bạn" : reply.sender?.name || "Unknown"}
        </span>
        {badge}
      </div>
      <p className="text-sm text-gray-700 line-clamp-2 text-left">
        {previewText}
      </p>
    </button>
  );
}

