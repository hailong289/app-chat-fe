"use client";

import React, { useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import {
  DocumentArrowDownIcon,
  ArrowDownCircleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { Card, CardBody, Button, Input } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";

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

  const [documents] = useState<DocumentItem[]>([
    {
      id: "1",
      name: "Project Proposal.pdf",
      link: "/documents/project-proposal.pdf",
      size: "2.5 MB",
      date: "2023-10-01",
    },
    {
      id: "2",
      name: "Meeting Notes.docx",
      link: "/documents/meeting-notes.docx",
      size: "1.2 MB",
      date: "2023-09-28",
    },
    {
      id: "3",
      name: "Budget.xlsx",
      link: "/documents/budget.xlsx",
      size: "3.1 MB",
      date: "2023-09-25",
    },
    {
      id: "4",
      name: "Design Mockup.png",
      link: "/documents/design-mockup.png",
      size: "4.8 MB",
      date: "2023-09-20",
    },
    {
      id: "5",
      name: "Final Report.pdf",
      link: "/documents/final-report.pdf",
      size: "5.0 MB",
      date: "2023-09-15",
    },
  ]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleClose = () => {
    router.push(pathname || "/");
  };

  const filteredDocuments = useMemo(() => {
    if (!searchValue.trim()) return documents;
    const q = searchValue.toLowerCase();
    return documents.filter((d) => d.name.toLowerCase().includes(q));
  }, [documents, searchValue]);

  return (
    <Card className="w-full h-full rounded-none shadow-none border-none bg-background text-foreground">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-default-200 bg-background">
          <div className="flex items-center">
            <div className="ml-1">
              <h2 className="text-lg font-semibold">Tài liệu</h2>
              <p className="text-sm text-foreground-500">
                Tìm kiếm tài liệu của bạn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500 hover:text-foreground hover:bg-default-100"
              onPress={() => setShowSearch((v) => !v)}
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </Button>
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500 hover:text-foreground hover:bg-default-100"
              onPress={handleClose}
            >
              <XMarkIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <form
            className="px-4 py-3 flex items-center gap-2 border-b border-default-200 bg-background"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              className="flex-1"
              placeholder="Tìm kiếm..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              autoFocus
              variant="bordered"
              classNames={{
                inputWrapper:
                  "bg-default-100 border-default-200 focus-within:border-primary",
                input: "text-foreground placeholder:text-foreground-400",
              }}
              startContent={
                <MagnifyingGlassIcon className="w-4 h-4 text-foreground-400" />
              }
            />
          </form>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-background">
          {filteredDocuments.length === 0 ? (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-sm text-foreground-500">
                Không tìm thấy tài liệu nào phù hợp.
              </p>
            </div>
          ) : (
            filteredDocuments.map((item) => (
              <Card
                key={item.id}
                className="mb-0 rounded-none shadow-none border-b border-default-200 bg-background"
              >
                <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
                  <div className="flex items-start gap-4 w-full">
                    {/* Icon */}
                    <div className="w-2/12 flex items-center justify-center">
                      <Button
                        isIconOnly
                        variant="light"
                        className="bg-primary/10 text-primary rounded-full p-5 w-15 h-15 hover:bg-primary/20"
                      >
                        <DocumentArrowDownIcon className="w-8 h-8" />
                      </Button>
                    </div>

                    {/* Info */}
                    <div className="w-8/12 flex flex-col">
                      <span className="font-medium leading-tight truncate">
                        {item.name}
                      </span>
                      <div className="text-sm text-foreground-500 font-semibold leading-tight">
                        {item.size}
                      </div>
                      <div className="text-xs text-foreground-400 mt-1">
                        {item.date}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        isIconOnly
                        variant="light"
                        className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                      >
                        <ShareIcon className="w-5 h-5" />
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                      >
                        <ArrowDownCircleIcon className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default Document;
