import React from 'react';
import { 
  Navbar, 
  NavbarContent, 
  NavbarItem, 
  Button, 
  Avatar, 
  Chip 
} from '@heroui/react';
import { 
  PencilIcon, 
  MagnifyingGlassIcon, 
  VideoCameraIcon, 
  PhoneIcon, 
  EllipsisVerticalIcon 
} from '@heroicons/react/24/outline';

interface ChatHeaderProps {
  chatName?: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  chatName = "Family Ties",
  isOnline = true,
  avatarUrl = "https://avatar.iran.liara.run/public"
}) => {
  return (
    <div className="w-full h-[80px]">
      <Navbar 
        isBordered 
        className="bg-primary border-b border-cyan-200 h-[80px]"
        maxWidth="full"
      >
        <NavbarContent justify="start" className="flex-grow-0">
          <NavbarItem className="flex items-center gap-3">
            <Avatar 
              src={avatarUrl}
              alt={chatName}
              size="sm"
              className="w-10 h-10"
            />
            <div className="flex flex-col">
              <p className="font-semibold text-white text-sm">{chatName}</p>
              <div className="flex items-center gap-1">
                <Chip 
                  size="sm" 
                  variant="dot" 
                  color={isOnline ? "success" : "default"}
                  className="p-0 border-none bg-transparent"
                >
                  <span className="text-xs text-white">
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </Chip>
              </div>
            </div>
          </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end" className="gap-1">
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              className="rounded-full hover:bg-cyan-100 text-white"
              size="sm"
            >
              <PencilIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              className="rounded-full hover:bg-cyan-100 text-white"
              size="sm"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              className="rounded-full hover:bg-cyan-100 text-white"
              size="sm"
            >
              <VideoCameraIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              className="rounded-full hover:bg-cyan-100 text-white"
              size="sm"
            >
              <PhoneIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              className="rounded-full hover:bg-cyan-100 text-white"
              size="sm"
            >
              <EllipsisVerticalIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
    </div>
  );
};

export default ChatHeader;