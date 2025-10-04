import React from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Card, CardBody, Avatar, Button } from '@heroui/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NotificationItem {
    id: string;
    name: string;
    avatar: string;
    subtitle: string;
    message: string;
    badgeColor?: string;
    badgeText?: string;
}

const Notification: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const [notifications, setNotifications] = useState<NotificationItem[]>([
        {
            id: '1',
            name: 'Josephin water',
            avatar: '/avatars/josephin.jpg',
            subtitle: 'Upload New Photos',
            message: 'I would suggest you discuss this f…',
        },
        {
            id: '2',
            name: 'Jony Today Birthday',
            avatar: '',
            subtitle: 'Upload New Photos',
            message: 'I would suggest you discuss this f…',
            badgeColor: 'bg-green-500',
            badgeText: 'A',
        },
        {
            id: '3',
            name: 'Sufiya Elija',
            avatar: '/avatars/sufiya.jpg',
            subtitle: 'Comment On your Photo',
            message: 'I would suggest you discuss this f…',
        },
        {
            id: '4',
            name: 'Pabelo Mukrani',
            avatar: '/avatars/pabelo.jpg',
            subtitle: 'Invite Your New Friend',
            message: 'I would suggest you discuss this f…',
            badgeColor: 'bg-yellow-400',
        },
        {
            id: '5',
            name: 'Pabelo Mukrani',
            avatar: '',
            subtitle: 'Update Profile Picture',
            message: 'I would suggest you discuss this f…',
            badgeColor: 'bg-green-500',
            badgeText: 'AC',
        },
    ]);

    const handleRemove = (id: string) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const handleClose = () => () => {
        router.push(pathname || '/');
    }

    return (
        <Card className="bg-white w-full shadow-none border-none rounded-none">
            <CardBody>
                <div className="flex items-center justify-between p-6 pb-2 border-b border-gray-200">
                    <div>
                        <h2 className="text-3xl font-semibold leading-tight">Thông báo</h2>
                        <p className="text-gray-400 text-xl mt-1">Lưu trữ tin nhắn…</p>
                    </div>
                    <Button isIconOnly variant="light" className="text-gray-500" onPress={handleClose()}>
                        <XMarkIcon className="w-8 h-8" />
                    </Button>
                </div>
                <div>
                    {notifications.map((item) => (
                        <Card key={item.id} className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                            <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                                <div className="flex items-start gap-4">
                                    {item.avatar ? (
                                        <Avatar src={item.avatar} size="lg" className="min-w-[56px] min-h-[56px]" />
                                    ) : (
                                        <div className={`min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-white text-2xl font-bold ${item.badgeColor || 'bg-green-500'}`}>
                                            {item.badgeText || item.name.split(' ').map(w => w[0]).join('').toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold leading-tight">{item.name}</span>
                                        </div>
                                        <div className="text-gray-400 text-base mt-1 truncate max-w-[260px]">{item.message}</div>
                                    </div>
                                </div>
                                <Button isIconOnly variant="light" className="text-gray-400 opacity-80 hover:opacity-100" onPress={() => handleRemove(item.id)}>
                                    <XMarkIcon className="w-7 h-7" />
                                </Button>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
};

export default Notification;