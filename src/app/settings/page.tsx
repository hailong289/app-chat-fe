
"use client";
import { Card, CardBody, Button, Avatar } from '@heroui/react';
import { ChatBubbleLeftRightIcon, PhoneIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { ShareIcon } from '@heroicons/react/24/outline';

export default function SettingsLayout() {
    return (
        <div className="bg-light min-h-screen w-full p-6">
            <div className="w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left side */}
                <div className="flex flex-col gap-6 md:col-span-1">
                    {/* Profile Card */}
                    <Card className="rounded-2xl">
                        <CardBody>
                            <div className="flex flex-col items-center py-6">
                                <Avatar src="https://avatar.iran.liara.run/public" size="lg" className="w-28 h-28 mb-2" />
                                <div className="text-2xl font-semibold text-primary mb-4">Lea</div>
                                <div className="flex gap-8 mt-2">
                                    <div className="flex flex-col items-center">
                                        <Button isIconOnly variant="light" className="bg-red-100 text-red-400 mb-1">
                                            <ChatBubbleLeftRightIcon className="w-6 h-6" />
                                        </Button>
                                        <span className="text-xs text-red-400 font-semibold">Tin nhắn</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <Button isIconOnly variant="light" className="bg-green-100 text-green-500 mb-1">
                                            <PhoneIcon className="w-6 h-6" />
                                        </Button>
                                        <span className="text-xs text-green-500 font-semibold">Cuộc gọi</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <Button isIconOnly variant="light" className="bg-green-100 text-green-500 mb-1">
                                            <VideoCameraIcon className="w-6 h-6" />
                                        </Button>
                                        <span className="text-xs text-green-500 font-semibold">Cuộc gọi video</span>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="rounded-2xl">
                        <CardBody className="p-0">
                            <div className="divide-y">
                                <a href="#" className="flex items-center px-6 py-4 gap-3 hover:bg-gray-50 transition border-b border-gray-200">
                                    {/* <FaFacebookF className="text-blue-600 w-5 h-5" /> */}
                                    <span className="text-base font-medium">Facebook</span>
                                    <span className="ml-auto">
                                        <ShareIcon className="w-5 h-5" />
                                    </span>
                                </a>
                                <a href="#" className="flex items-center px-6 py-4 gap-3 hover:bg-gray-50 transition border-b border-gray-200">
                                    {/* <FaTwitter className="text-sky-400 w-5 h-5" /> */}
                                    <span className="text-base font-medium">Twitter</span>
                                    <span className="ml-auto">
                                        <ShareIcon className="w-5 h-5" />
                                    </span>
                                </a>
                                <a href="#" className="flex items-center px-6 py-4 gap-3 hover:bg-gray-50 transition border-b border-gray-200">
                                    <span className="text-base font-medium">Google</span>
                                    <span className="ml-auto">
                                        <ShareIcon className="w-5 h-5" />
                                    </span>
                                </a>
                            </div>
                        </CardBody>
                    </Card>
                </div>
                {/* Right side */}
                <div className="md:col-span-2">
                    <Table aria-label="Contact Info table">
                        <TableHeader>
                            <TableColumn>
                                <h2 className="text-xl font-semibold">Thông tin cá nhân</h2>
                            </TableColumn>
                            <TableColumn>{''}</TableColumn>
                        </TableHeader>
                        <TableBody>
                            <TableRow key="1">
                                <TableCell>Name</TableCell>
                                <TableCell>lea</TableCell>
                            </TableRow>
                            <TableRow key="2">
                                <TableCell>Gender</TableCell>
                                <TableCell>male</TableCell>
                            </TableRow>
                            <TableRow key="3">
                                <TableCell>Birthday</TableCell>
                                <TableCell>1 april 1995</TableCell>
                            </TableRow>
                            <TableRow key="4">
                                <TableCell>Favorite Book</TableCell>
                                <TableCell>perfect chemistry</TableCell>
                            </TableRow>
                            <TableRow key="5">
                                <TableCell>Personality</TableCell>
                                <TableCell>cool</TableCell>
                            </TableRow>
                            <TableRow key="6">
                                <TableCell>City</TableCell>
                                <TableCell>moline acres</TableCell>
                            </TableRow>
                            <TableRow key="7">
                                <TableCell>Mobile No</TableCell>
                                <TableCell>+21 3523 25544</TableCell>
                            </TableRow>
                            <TableRow key="8">
                                <TableCell>Email</TableCell>
                                <TableCell>pixelstrap@test.com</TableCell>
                            </TableRow>
                            <TableRow key="9">
                                <TableCell>Website</TableCell>
                                <TableCell>www.test.com</TableCell>
                            </TableRow>
                            <TableRow key="10">
                                <TableCell>Interest</TableCell>
                                <TableCell>photography</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}