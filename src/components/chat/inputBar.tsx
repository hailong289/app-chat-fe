import {
  Bars3Icon,
  FaceSmileIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/16/solid";
import { Button } from "@heroui/button";
import { Input } from "@heroui/react";

export default function ChatInputBar() {
  return (
    <div className="absolute bottom-8 left-[5%] bg-white w-[90%] p-4 rounded-2xl">
      <div className="flex items-center gap-3">
        {/* Left icons */}
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
          >
            <MicrophoneIcon className="w-5 h-5" />
          </Button>
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
          >
            <Bars3Icon className="w-5 h-5" />
          </Button>
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
          >
            <FaceSmileIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Message input */}
        <div className="flex-1">
          <Input
            placeholder="Aa"
            classNames={{
              input: "bg-white",
              inputWrapper:
                "bg-white border-gray-200 hover:border-teal-500 focus-within:border-teal-500",
            }}
            size="lg"
          />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            radius="full"
          >
            <MicrophoneIcon className="w-5 h-5" />
          </Button>
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            radius="full"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
