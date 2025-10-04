
"use client";
import { Card, CardBody, Button, Form, Switch } from '@heroui/react';

export default function SettingsIntegration() {
    return (
        <div className="bg-light h-screen w-full p-6">
            <div className="w-12/12 mx-auto">
                {/* Left side */}
                <div className="flex flex-col gap-6 md:col-span-1">
                    {/* Profile Card */}
                    <Card className="rounded-2xl">
                        <CardBody className="p-6">
                            <h2 className="text-xl font-semibold mb-2">Tích hợp</h2>
                            <div className="text-gray-400 font-semibold mb-4">Thiết lập tích hợp với các dịch vụ bên thứ ba</div>
                            <div className="flex gap-1 flex-col">
                               <Button color="primary" className="w-2/12 mt-4">Liên kết google</Button>
                                <Button color="primary" className="w-2/12 mt-4">Liên kết outlook</Button>  
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}