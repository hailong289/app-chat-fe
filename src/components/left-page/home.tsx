"use client";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Avatar,
  Badge,
  Tabs,
  Tab,
} from "@heroui/react";
import { useRouter } from "next/navigation";
export const Home = () => {
     const router = useRouter();
    return (
        <>
            {/* Top Bar */}
          <Card className="rounded-none shadow-none">
            <CardBody className="p-4 flex flex-row items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar
                  src="https://avatar.iran.liara.run/public"
                  name="Rohini Sharma"
                  size="md"
                />
                <div>
                  <h1 className="font-bold">Rohini Sharma</h1>
                  <Chip size="sm" variant="flat" className="bg-primary text-white">
                    Bận
                  </Chip>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button isIconOnly variant="light" className="text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 10-2 0z" />
                  </svg>
                </Button>
                <div className="w-2 h-2 bg-success rounded-full"></div>
              </div>
            </CardBody>
          </Card>

          {/* Status Section */}
          <Card className="rounded-none shadow-none border-b border-gray-200">
            <CardBody className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">Status</h2>
                <Button variant="light" size="sm" className="text-primary">
                  View All
                </Button>
              </div>
              <div className="flex space-x-4 overflow-x-auto p-1">
                <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                  <Badge
                    content=" "
                    color="success"
                    placement="bottom-right"
                  >
                    <Avatar
                      src="https://avatar.iran.liara.run/public"
                      name="My Status"
                      size="lg"
                      isBordered
                      color="success"
                    />
                  </Badge>
                  <p className="text-xs text-gray-600 text-center">My Status</p>
                </div>
                {['Jesus', 'Mari', 'Kristin', 'Lea'].map((name, index) => (
                  <div key={index} className="flex flex-col items-center space-y-1 flex-shrink-0">
                    <Avatar
                      src={`https://avatar.iran.liara.run/public?text=${name.charAt(0)}`}
                      name={name}
                      size="lg"
                    />
                    <p className="text-xs text-gray-600 text-center">{name}...</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Messages Section */}
          <div className="flex-1 overflow-y-auto">
            <Card className="rounded-none shadow-none border-b border-gray-200">
              <CardBody className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold text-gray-800">Message (10)</h2>
                  <Button isIconOnly variant="light" size="sm" color="primary">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </Button>
                </div>
                <div className="mb-3 w-full">
                  <Tabs 
                    aria-label="Message options"
                    variant="solid"
                    color="primary"
                    fullWidth
                  >
                    <Tab key="chat" title="Chat" />
                    <Tab key="call" title="Call" />
                    <Tab key="contact" title="Contact" />
                  </Tabs>
                </div>
                <div className="w-8/12 mx-auto mb-3">
                  <Tabs 
                    aria-label="Chat type"
                    variant="solid"
                    color="primary"
                    fullWidth
                  >
                    <Tab key="direct" title="Direct" />
                    <Tab key="group" title="Group" />
                  </Tabs>
                </div>
              </CardBody>
            </Card>

            {/* Chat List */}
            <div className="divide-y divide-gray-200">
              {/* Josephine Water */}
              {[
                { name: "Jesus", message: "Hello, how are you?", time: "10:30 AM", avatar: "https://avatar.iran.liara.run/public?text=J" },
                { name: "Mari", message: "Let's catch up later.", time: "9:15 AM", avatar: "https://avatar.iran.liara.run/public?text=M" },
                { name: "Kristin", message: "Meeting at 3 PM.", time: "Yesterday", avatar: "https://avatar.iran.liara.run/public?text=K" },
                { name: "Lea", message: "Happy Birthday!", time: "2 days ago", avatar: "https://avatar.iran.liara.run/public?text=L" },
              ].map((chat, index) => (
                <Card key={index} className="rounded-none shadow-none cursor-pointer hover:bg-gray-50">
                  <CardBody className="p-4 flex flex-row items-center justify-between" onClick={() => {
                    // Handle chat selection
                    console.log(`Selected chat with ${chat.name}`);
                    // You can use useRouter to navigate if needed
                   
                    router.push(`/chat?chatId=${chat.name}`);
                  }}>
                    <div className="flex items-center space-x-3">
                      <Avatar
                        src={chat.avatar}
                        name={chat.name}
                        size="md"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-800">{chat.name}</h3>
                        <p className="text-sm text-gray-500">{chat.message}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{chat.time}</p>
                      <Badge color="primary" size="sm">2</Badge>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </>
    );
}