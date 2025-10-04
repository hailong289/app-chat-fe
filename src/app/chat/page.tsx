"use client";

import ChatHeader from "@/components/chat/header";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
    MicrophoneIcon,
    Bars3Icon,
    FaceSmileIcon,
    PaperAirplaneIcon
} from "@heroicons/react/24/outline";
import { Avatar } from "@heroui/react";

export default function ChatPage() {
    return (
        <div className="bg-light h-screen w-full">
            <ChatHeader />
            <main className="w-full h-[calc(100vh-80px)] relative">
                {/* Chat messages would go here */}
                <div className="p-4 space-y-4 overflow-y-auto h-full">
                    {/* Example message */}
                    <div className="flex justify-start">
                        <Avatar
                            src="https://avatar.iran.liara.run/public"
                            name="Rohini Sharma"
                            size="sm"
                            className="w-8 h-8 mr-2"
                        />
                        <div className="bg-white p-3 rounded-lg shadow max-w-xs">
                            Hello! How are you?
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <div className="bg-primary text-white p-3 rounded-lg shadow max-w-xs">
                            I'm good, thanks! And you?
                        </div>
                        <Avatar
                            src="https://avatar.iran.liara.run/public"
                            name="You"
                            size="sm"
                            className="w-8 h-8 ml-2"
                        />
                    </div>
                    {/* More messages... */}
                </div>
                    
                {/* Message input area */}
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
                                placeholder="Write your message..."
                                classNames={{
                                    input: "bg-white",
                                    inputWrapper: "bg-white border-gray-200 hover:border-teal-500 focus-within:border-teal-500"
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
            </main>
        </div>
    )
}