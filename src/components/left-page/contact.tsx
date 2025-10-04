import React from 'react';
import Image from 'next/image';
import { ChevronUpIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { Card, CardBody, Avatar, Badge, Button, Tabs, Tab, Input } from '@heroui/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface StatusUpdate {
    id: string;
    name: string;
    time: string;
    avatar: string;
}

const Contacts: React.FC = () => {
    const [tab, setTab] = useState(0);
    const [showSearch, setShowSearch] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const friendRequests: StatusUpdate[] = [
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
    ];

    const sentRequests: StatusUpdate[] = [
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

    return (
        <Card className="bg-white w-full shadow-none border-none rounded-none">
            <CardBody>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="ml-3">
                            <h2 className="text-xl font-semibold">Kết nối bạn bè</h2>
                            <p className="text-gray-500 text-sm">
                                Thêm bạn mới để trò chuyện cùng họ
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button isIconOnly variant="light" className="text-gray-500" onClick={() => setShowSearch(v => !v)}>
                            <MagnifyingGlassIcon className="w-5 h-5" />
                        </Button>
                        <Button isIconOnly variant="light" className="text-gray-500" onClick={() => router.push('/')}>
                            <XMarkIcon className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {showSearch && (
                    <form className="mt-5 px-2 flex items-center gap-2 " onSubmit={e => e.preventDefault()}>
                        <Input
                            className="flex-1"
                            placeholder="Tìm kiếm..."
                            value={searchValue}
                            onChange={e => setSearchValue(e.target.value)}
                            autoFocus
                        />
                    </form>
                )}

                {/* Tabs for friend requests and sent requests */}
                <div className="px-2 w-full mt-5">
                    <Tabs
                        selectedKey={tab.toString()}
                        onSelectionChange={key => setTab(Number(key))}
                        color="primary"
                        variant="solid"
                        aria-label="Tabs for friend requests and sent requests"
                        fullWidth
                    >
                        <Tab key="0" title="Yêu cầu kết bạn">
                            {friendRequests.map((update) => (
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
                        </Tab>
                        <Tab key="1" title="Đã gửi yêu cầu">
                            {sentRequests.map((update) => (
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
                        </Tab>
                    </Tabs>
                </div>
            </CardBody>
        </Card>
    );
};

export default Contacts;