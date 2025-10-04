import { Button, Drawer, DrawerBody, DrawerContent, DrawerHeader, Tabs, Tab, Card, CardBody, Avatar } from "@heroui/react"
import { XMarkIcon, ArrowDownTrayIcon, ShareIcon } from "@heroicons/react/24/solid"
import { DocumentTextIcon, FilmIcon, TableCellsIcon, DocumentIcon } from "@heroicons/react/24/outline"

export default function ChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const files = [
        { id: 1, name: "Messenger.Html", date: "2, October 2024", icon: DocumentTextIcon, color: "bg-red-100 text-red-500" },
        { id: 2, name: "Chapter1.MP4", date: "3, October 2024", icon: FilmIcon, color: "bg-green-100 text-green-500" },
        { id: 3, name: "Salary.Xlsx", date: "5, October 2024", icon: TableCellsIcon, color: "bg-teal-100 text-teal-500" },
        { id: 4, name: "Document.Pdf", date: "7, October 2024", icon: DocumentIcon, color: "bg-yellow-100 text-yellow-500" },
        { id: 5, name: "Details.Txt", date: "20, October 2024", icon: DocumentTextIcon, color: "bg-pink-100 text-pink-500" },
        { id: 6, name: "Messenger.Html", date: "2, October 2024", icon: DocumentTextIcon, color: "bg-green-100 text-green-500" },
    ];

    return (
        <Drawer isOpen={isOpen} onOpenChange={onClose} backdrop="transparent" className="w-[400px]">
            <DrawerContent>
                {() => (
                    <>
                        <DrawerHeader className="flex items-center justify-between p-6 relative">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Tệp tài liệu</h2>
                                <p className="text-gray-500">Chia sẻ tài nguyên...</p>
                            </div>
                        </DrawerHeader>
                        <DrawerBody className="p-6 pt-0">
                            <div className="mb-6">
                                <Tabs 
                                    defaultSelectedKey="docs"
                                    color="primary"
                                    variant="solid"
                                    fullWidth
                                    classNames={{
                                        tabList: "gap-0 w-full relative rounded-lg bg-gray-100 p-1",
                                        cursor: "w-full bg-primary !rounded-md",
                                        tab: "w-full px-4 h-10 !bg-transparent data-[selected=true]:!bg-primary !rounded-md",
                                        tabContent: "group-data-[selected=true]:!text-white !font-medium !opacity-100"
                                    }}
                                >
                                    <Tab key="media" title="Media" />
                                    <Tab key="link" title="Link" />
                                    <Tab key="docs" title="Docs" />
                                </Tabs>
                            </div>
                            
                            <div className="space-y-4">
                                {files.map((file) => (
                                    <Card key={file.id} className="shadow-none border border-gray-100">
                                        <CardBody className="flex flex-row items-center justify-between p-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${file.color}`}>
                                                    <file.icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-800">{file.name}</h3>
                                                    <p className="text-sm text-gray-500">{file.date}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    isIconOnly 
                                                    variant="light" 
                                                    size="sm"
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                            
                            {/* Floating action buttons
                            <div className="fixed bottom-6 right-6 flex flex-col gap-3">
                                <Button 
                                    isIconOnly 
                                    color="success" 
                                    className="rounded-full w-12 h-12 shadow-lg"
                                >
                                    <ShareIcon className="w-6 h-6" />
                                </Button>
                                <Button 
                                    isIconOnly 
                                    color="primary" 
                                    className="rounded-full w-12 h-12 shadow-lg"
                                >
                                    <ArrowDownTrayIcon className="w-6 h-6" />
                                </Button>
                            </div> */}
                        </DrawerBody>
                    </>
                )}
            </DrawerContent>
        </Drawer>
    );
}