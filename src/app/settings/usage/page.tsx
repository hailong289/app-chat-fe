"use client";

import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
} from "@heroui/react";
import { useEffect, useState, useCallback } from "react";
import { aiService } from "@/service/ai.service";

type GroupBy = "service" | "userId" | "day";
type ReportItem = {
  group: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  totalTokenInput: number;
  totalTokenOutput: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  uniqueUserCount: number;
};

const SERVICE_OPTIONS = [
  { key: "", label: "Tất cả" },
  { key: "moderation", label: "Kiểm duyệt" },
  { key: "summary-document", label: "Tóm tắt tài liệu" },
  { key: "translation", label: "Dịch thuật" },
  { key: "generate-quizz", label: "Tạo câu hỏi" },
  { key: "generate-flashcard", label: "Tạo flashcard" },
  { key: "speech-to-text", label: "Nhận dạng giọng nói" },
  { key: "suggest-replies", label: "Gợi ý trả lời" },
];

const GROUP_BY_OPTIONS = [
  { key: "service", label: "Theo dịch vụ" },
  { key: "userId", label: "Theo người dùng" },
  { key: "day", label: "Theo ngày" },
];

const SERVICE_LABELS: Record<string, string> = {
  moderation: "Kiểm duyệt",
  "summary-document": "Tóm tắt tài liệu",
  translation: "Dịch thuật",
  "generate-quizz": "Tạo câu hỏi",
  "generate-flashcard": "Tạo flashcard",
  "speech-to-text": "Nhận dạng giọng nói",
  "suggest-replies": "Gợi ý trả lời",
};

export default function SettingsUsage() {
  const [report, setReport] = useState<ReportItem[]>([]);
  const [totalCalls, setTotalCalls] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("service");
  const [serviceFilter, setServiceFilter] = useState("");
  const [timeRange, setTimeRange] = useState("7");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - parseInt(timeRange));

      const result = await aiService.getUsageReport({
        groupBy,
        service: serviceFilter || undefined,
        from: from.toISOString(),
        to: now.toISOString(),
      });
      setReport(result.items || []);
      setTotalCalls(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch AI usage report:", err);
      setReport([]);
      setTotalCalls(0);
    } finally {
      setLoading(false);
    }
  }, [groupBy, serviceFilter, timeRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCost = (usd: number) => {
    if (usd < 0.001) return `~$${usd.toFixed(6)}`;
    return `$${usd.toFixed(4)}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString("vi-VN");
  };

  return (
    <div className="bg-light min-h-screen w-full p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          📊 Thống kê sử dụng AI
        </h1>

        {/* Filters */}
        <Card className="rounded-2xl shadow-md mb-6">
          <CardBody className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Nhóm theo"
                selectedKeys={[groupBy]}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                variant="bordered"
                size="sm"
              >
                {GROUP_BY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Dịch vụ"
                selectedKeys={[serviceFilter]}
                onChange={(e) => setServiceFilter(e.target.value)}
                variant="bordered"
                size="sm"
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select
                label="Khoảng thời gian"
                selectedKeys={[timeRange]}
                onChange={(e) => setTimeRange(e.target.value)}
                variant="bordered"
                size="sm"
              >
                <SelectItem key="7">7 ngày qua</SelectItem>
                <SelectItem key="30">30 ngày qua</SelectItem>
                <SelectItem key="90">3 tháng qua</SelectItem>
                <SelectItem key="365">1 năm qua</SelectItem>
              </Select>
            </div>
            <Button
              color="primary"
              onPress={fetchReport}
              isLoading={loading}
              size="sm"
              className="mt-1"
            >
              Lọc
            </Button>
          </CardBody>
        </Card>

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="rounded-xl shadow-sm">
              <CardBody className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">
                  {formatNumber(totalCalls)}
                </p>
                <p className="text-sm text-foreground-500 mt-1">
                  Tổng lượt gọi
                </p>
              </CardBody>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardBody className="p-4 text-center">
                <p className="text-3xl font-bold text-success">
                  {formatNumber(
                    report.reduce((s, r) => s + r.successCalls, 0)
                  )}
                </p>
                <p className="text-sm text-foreground-500 mt-1">
                  Thành công
                </p>
              </CardBody>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardBody className="p-4 text-center">
                <p className="text-3xl font-bold text-danger">
                  {formatNumber(
                    report.reduce((s, r) => s + r.errorCalls, 0)
                  )}
                </p>
                <p className="text-sm text-foreground-500 mt-1">Thất bại</p>
              </CardBody>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardBody className="p-4 text-center">
                <p className="text-3xl font-bold text-warning">
                  {formatCost(
                    report.reduce((s, r) => s + r.totalCostUsd, 0)
                  )}
                </p>
                <p className="text-sm text-foreground-500 mt-1">
                  Tổng chi phí
                </p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card className="rounded-2xl shadow-md">
          <CardBody className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" label="Đang tải..." />
              </div>
            ) : report.length === 0 ? (
              <div className="text-center py-12 text-foreground-500">
                Chưa có dữ liệu sử dụng AI trong khoảng thời gian này.
              </div>
            ) : (
              <Table
                aria-label="AI Usage Report"
                removeWrapper
                classNames={{ base: "overflow-x-auto" }}
              >
                <TableHeader>
                  <TableColumn>
                    {groupBy === "service"
                      ? "Dịch vụ"
                      : groupBy === "userId"
                        ? "Người dùng"
                        : "Ngày"}
                  </TableColumn>
                  <TableColumn align="end">Tổng lượt</TableColumn>
                  <TableColumn align="end">Thành công</TableColumn>
                  <TableColumn align="end">Thất bại</TableColumn>
                  <TableColumn align="end">Token In</TableColumn>
                  <TableColumn align="end">Token Out</TableColumn>
                  <TableColumn align="end">Chi phí</TableColumn>
                  <TableColumn align="end">Độ trễ (TB)</TableColumn>
                  <TableColumn align="end">Người dùng</TableColumn>
                </TableHeader>
                <TableBody>
                  {report.map((item) => (
                    <TableRow key={item.group}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {groupBy === "service"
                              ? SERVICE_LABELS[item.group] || item.group
                              : groupBy === "day"
                                ? new Date(item.group).toLocaleDateString(
                                    "vi-VN"
                                  )
                                : item.group.slice(0, 12) + "..."}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatNumber(item.totalCalls)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color="success"
                          variant="flat"
                          size="sm"
                        >
                          {formatNumber(item.successCalls)}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={item.errorCalls > 0 ? "danger" : "default"}
                          variant="flat"
                          size="sm"
                        >
                          {formatNumber(item.errorCalls)}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatNumber(item.totalTokenInput)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatNumber(item.totalTokenOutput)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatCost(item.totalCostUsd)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.avgLatencyMs.toFixed(0)}ms
                      </TableCell>
                      <TableCell>{item.uniqueUserCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
