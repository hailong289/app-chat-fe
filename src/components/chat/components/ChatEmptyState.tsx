import { FaceSmileIcon } from "@heroicons/react/16/solid";

export function ChatEmptyState() {
  return (
    <div className="text-center text-gray-500 mt-10">
      <div className="mb-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <FaceSmileIcon className="w-8 h-8 text-gray-400" />
        </div>
      </div>
      <p className="text-lg font-medium">Chưa có tin nhắn nào</p>
      <p className="text-sm mt-1">Bắt đầu trò chuyện thôi!</p>
    </div>
  );
}

