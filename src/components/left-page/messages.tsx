import React from 'react';
import Image from 'next/image';
import { ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Card, CardBody, Avatar, Badge, Button } from '@heroui/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter } from 'next/navigation';

interface StatusUpdate {
    id: string;
    name: string;
    time: string;
    avatar: string;
}

const Messages: React.FC = () => {
    const recentUpdates: StatusUpdate[] = [
        {
            id: '1',
            name: 'Jony Lynetin',
            time: 'Today, 10:30am',
            avatar: 'https://avatar.iran.liara.run/public?text=J',
        },
        {
            id: '2',
            name: 'Sufiya Elija',
            time: 'Today, 11:00am',
            avatar: 'https://avatar.iran.liara.run/public?text=S',
        },
        {
            id: '3',
            name: 'Mukrani Pabelo',
            time: 'Today, 9:55am',
            avatar: 'https://avatar.iran.liara.run/public?text=M',
        },
        {
            id: '4',
            name: 'Pabelo Mukrani',
            time: 'Today, 12:05am',
            avatar: 'https://avatar.iran.liara.run/public?text=P',
        },
    ];

    const router = useRouter();
    const pathname = usePathname();
    const handleClose = () => () => {
        router.push(pathname || '/');
    }
    return (
        <Card className="bg-white w-full shadow-none border-none rounded-none">
            <CardBody>
                {/* Header with user profile and close button */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="relative">
                            <Avatar
                                src="https://avatar.iran.liara.run/public"
                                name="My Status"
                                size="lg"
                                isBordered
                                color="success"
                            />
                            <div className="absolute bottom-0 right-0 bg-teal-500 rounded-full p-1 border-2 border-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-3">
                            <h2 className="text-xl font-semibold">Trạng thái của tôi</h2>
                            <p className="text-gray-500 text-sm">Nhấn để thêm cập nhật trạng thái</p>
                        </div>
                    </div>
                    <Button isIconOnly variant="light" className="text-gray-500" onPress={handleClose()}>
                        <XMarkIcon className="w-5 h-5" />
                    </Button>
                </div>

                {/* Recent Updates Section */}
                <div className="p-4 bg-green-50 mx-2 my-4 rounded-lg">
                    <h3 className="text-lg font-medium text-teal-600">Cập nhật gần đây</h3>
                </div>

                {/* Recent Updates List */}
                <div className="px-2">
                    {recentUpdates.map((update) => (
                        <Card key={update.id} className="mb-2 shadow-none border border-teal-100">
                            <CardBody className="flex items-center py-3 flex-row">
                                <Badge content=" " color="success" placement="bottom-right">
                                    <Avatar
                                        src={update.avatar}
                                        name={update.name}
                                        size="md"
                                        isBordered
                                    />
                                </Badge>
                                <div className="ml-3">
                                    <h4 className="font-medium">{update.name}</h4>
                                    <p className="text-sm text-gray-500">{update.time}</p>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
};

export default Messages;