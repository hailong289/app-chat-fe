import React from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Card, CardBody, Avatar, Button, Input } from '@heroui/react';
import { LockClosedIcon, ShareIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { ArrowDownCircleIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';

interface DocumentItem {
    id: string;
    name: string;
    link: string;
    size: string;
    date: string;
}

const Settings: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const handleClose = () => () => {
        router.push(pathname || '/');
    }
    return (
        <Card className="bg-white w-full shadow-none border-none rounded-none">
            <CardBody>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="ml-3">
                            <h2 className="text-xl font-semibold">Tài liệu</h2>
                            <p className="text-gray-500 text-sm">
                                Tìm kiếm tài liệu của bạn
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button isIconOnly variant="light" className="text-gray-500" onPress={handleClose()}>
                            <XMarkIcon className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
                <div>
                    <Card className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                        <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                            <div className="flex items-start gap-4 w-full">
                                <div className="w-10/12 flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium leading-tight">Cài đặt tài khoản</span>
                                    </div>
                                    <div className="text-gray-400 font-semibold leading-tight">Cập nhật thông tin</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button isIconOnly variant="light" className="text-gray-500" onPress={() => router.push('/settings/account')}>
                                        <ArrowRightCircleIcon className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                        <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                            <div className="flex items-start gap-4 w-full">
                                <div className="w-10/12 flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium leading-tight">Cài đặt tin nhắn</span>
                                    </div>
                                    <div className="text-gray-400 font-semibold leading-tight">Thiết lập cài đặt tin nhắn</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button isIconOnly variant="light" className="text-gray-500" onPress={() => router.push('/settings/chat')}>
                                        <ArrowRightCircleIcon className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                        <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                            <div className="flex items-start gap-4 w-full">
                                <div className="w-10/12 flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium leading-tight">Tích hợp</span>
                                    </div>
                                    <div className="text-gray-400 font-semibold leading-tight">Thiết lập tích hợp</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button isIconOnly variant="light" className="text-gray-500" onPress={() => router.push('/settings/intergation')}>
                                        <ArrowRightCircleIcon className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                        <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                            <div className="flex items-start gap-4 w-full">
                                <div className="w-10/12 flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium leading-tight">Hỗ trợ</span>
                                    </div>
                                    <div className="text-gray-400 font-semibold leading-tight">Gửi phản hồi</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button isIconOnly variant="light" className="text-gray-500" onPress={() => router.push('/settings/support')}>
                                        <ArrowRightCircleIcon className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </CardBody>
        </Card>
    );
};

export default Settings;