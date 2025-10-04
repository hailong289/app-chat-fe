import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Avatar 
} from '@heroui/react';
import { MicrophoneIcon, PhoneIcon, PhoneXMarkIcon, VideoCameraIcon } from '@heroicons/react/24/solid';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  caller: {
    id: string;
    name: string;
    avatar?: string;
  };
  isVideo: boolean;
  isIncoming: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  caller,
  isVideo,
  isIncoming,
  onAccept,
  onDecline,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = () => {
    setIsCallActive(true);
    onAccept();
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setCallDuration(0);
    onDecline();
    onClose();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="md">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center">
              <h3 className="text-lg font-semibold">
                {isIncoming ? 'Incoming Call' : isCallActive ? 'Call in Progress' : 'Calling...'}
              </h3>
              <p className="text-sm text-gray-500">
                {isCallActive ? formatDuration(callDuration) : caller.name}
              </p>
            </ModalHeader>
            
            <ModalBody>
              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <Avatar 
                  src={caller.avatar}
                  name={caller.name}
                  size="lg"
                  className="w-24 h-24"
                />

                {isVideo && (
                  <div className="relative w-full">
                    <video
                      ref={remoteVideoRef}
                      className="w-full rounded-lg bg-gray-100"
                      autoPlay
                      playsInline
                    />
                    <video
                      ref={localVideoRef}
                      className="absolute bottom-4 right-4 w-1/4 rounded-lg border-2 border-white"
                      autoPlay
                      playsInline
                      muted
                    />
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex justify-center space-x-4">
              {isIncoming && !isCallActive ? (
                <>
                  <Button 
                    color="danger" 
                    className="rounded-full h-12 w-12 p-0" 
                    onPress={handleEndCall}
                    isIconOnly
                  >
                    <PhoneXMarkIcon className="h-6 w-6" />
                  </Button>
                  <Button 
                    color="success" 
                    className="rounded-full h-12 w-12 p-0" 
                    onPress={handleAccept}
                    isIconOnly
                  >
                    <PhoneIcon className="h-6 w-6" />
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    color={isMuted ? "primary" : "default"} 
                    className="rounded-full h-12 w-12 p-0" 
                    onPress={toggleMute}
                    isIconOnly
                  >
                    <MicrophoneIcon className="h-6 w-6" />
                  </Button>
                  <Button 
                    color="danger" 
                    className="rounded-full h-12 w-12 p-0" 
                    onPress={handleEndCall}
                    isIconOnly
                  >
                    <PhoneXMarkIcon className="h-6 w-6" />
                  </Button>
                  {isVideo && (
                    <Button 
                      color="default" 
                      className="rounded-full h-12 w-12 p-0" 
                      isIconOnly
                    >
                      <VideoCameraIcon className="h-6 w-6" />
                    </Button>
                  )}
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};