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

interface DocumentItem {
    id: string;
    name: string;
    link: string;
    size: string;
    date: string;
}

const Document: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const [documents, setDocuments] = useState<DocumentItem[]>([
        {
            id: '1',
            name: 'Project Proposal.pdf',
            link: '/documents/project-proposal.pdf',
            size: '2.5 MB',
            date: '2023-10-01',
        },
        {
            id: '2',
            name: 'Meeting Notes.docx',
            link: '/documents/meeting-notes.docx',
            size: '1.2 MB',
            date: '2023-09-28',
        },
        {
            id: '3',
            name: 'Budget.xlsx',
            link: '/documents/budget.xlsx',
            size: '3.1 MB',
            date: '2023-09-25',
        },
        {
            id: '4',
            name: 'Design Mockup.png',
            link: '/documents/design-mockup.png',
            size: '4.8 MB',
            date: '2023-09-20',
        },
        {
            id: '5',
            name: 'Final Report.pdf',
            link: '/documents/final-report.pdf',
            size: '5.0 MB',
            date: '2023-09-15',
        },
    ]);
    const [showSearch, setShowSearch] = useState(false);
    const [searchValue, setSearchValue] = useState("");

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
                        <Button isIconOnly variant="light" className="text-gray-500" onPress={() => setShowSearch(v => !v)}>
                            <MagnifyingGlassIcon className="w-5 h-5" />
                        </Button>
                        <Button isIconOnly variant="light" className="text-gray-500" onPress={handleClose()}>
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
                <div>
                    {documents.map((item) => (
                        <Card key={item.id} className="mb-2 shadow-none border-b border-gray-200 rounded-none">
                            <CardBody className="flex items-start justify-between px-4 py-6 flex-row">
                                <div className="flex items-start gap-4 w-full">
                                    <div className="w-2/12 rounded-full flex items-center justify-center">
                                        <Button isIconOnly variant="light" className="text-gray-500 bg-gray-200 rounded-full p-5 w-15 h-15">
                                            <DocumentArrowDownIcon className="w-10 h-10" />
                                        </Button>
                                    </div>
                                    
                                    <div className="w-8/12 flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium leading-tight">{item.name}</span>
                                        </div>
                                        <div className="text-gray-400 font-semibold leading-tight">{item.size}</div>
                                        <div className="text-gray-400 text-base mt-1">{item.date}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button isIconOnly variant="light" className="text-gray-500">
                                            <ShareIcon className="w-5 h-5" />
                                        </Button>
                                         <Button isIconOnly variant="light" className="text-gray-500">
                                            <ArrowDownCircleIcon className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
};

export default Document;