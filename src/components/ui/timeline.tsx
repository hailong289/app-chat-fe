import React, { useMemo } from "react";
import { Card, CardBody, Chip, Accordion, AccordionItem } from "@heroui/react";

// --- Types ---
export type Event = {
  id: string | number;
  timestamp: string;
  title: string;
  description: string;
  status: "success" | "warning" | "danger" | "primary" | "default";
};

type TimelineProps = {
  readonly title?: string;
  readonly events?: readonly Event[];
};

// --- Helpers ---
const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function YearlyTimeline({
  title = "",
  events = [],
}: TimelineProps) {
  // Group Data 3 Level
  const groupedData = useMemo(() => {
    const grouped: Record<string, Record<string, Record<string, Event[]>>> = {};
    // Sort
    const sorted = [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    sorted.forEach((ev) => {
      const d = new Date(ev.timestamp);
      const y = d.getFullYear().toString();
      const m = `Tháng ${d.getMonth() + 1}`;
      const day = `Ngày ${d.getDate()}`; // Giữ format ngắn gọn cho level 3

      if (!grouped[y]) grouped[y] = {};
      if (!grouped[y][m]) grouped[y][m] = {};
      if (!grouped[y][m][day]) grouped[y][m][day] = [];
      grouped[y][m][day].push(ev);
    });
    return grouped;
  }, [events]);

  const years = Object.keys(groupedData);

  return (
    <div className="w-full mx-auto p-4">
      <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
        {title}
      </h2>

      {/* --- LEVEL 1: NĂM (YEAR) --- */}
      <Accordion
        variant="splitted"
        selectionMode="multiple"
        defaultExpandedKeys={[years[0]]} // Mở năm mới nhất
        itemClasses={{ title: "font-black text-xl text-primary" }}
      >
        {years.map((year) => (
          <AccordionItem
            key={year}
            aria-label={year}
            title={`Năm ${year}`}
            subtitle="Lưu trữ toàn bộ hoạt động"
          >
            {/* --- LEVEL 2: THÁNG (MONTH) --- */}
            <Accordion
              selectionMode="multiple"
              variant="light" // Dùng light để đỡ nặng nề
              showDivider={true}
              itemClasses={{ title: "font-bold text-lg text-default-700" }}
              className="pl-2"
            >
              {Object.keys(groupedData[year]).map((month) => (
                <AccordionItem
                  key={`${year}-${month}`}
                  aria-label={month}
                  title={month}
                >
                  {/* --- LEVEL 3: NGÀY (DAY) --- */}
                  {/* Ở level này dùng style border-l (trục dọc) thay vì Accordion tiếp để đỡ click nhiều */}
                  <div className="pl-4 flex flex-col gap-6 pt-2">
                    {Object.keys(groupedData[year][month]).map((day) => (
                      <div
                        key={`${year}-${month}-${day}`}
                        className="relative border-l-2 border-default-200 pl-6 pb-2"
                      >
                        {/* Tiêu đề Ngày (Sticky cho dễ nhìn) */}
                        <div className="absolute -left-[9px] top-0 bg-background py-1">
                          <div className="w-4 h-4 rounded-full bg-primary border-4 border-background box-content" />
                        </div>
                        <h4 className="font-bold text-default-600 mb-4 -mt-1">
                          {day}
                        </h4>

                        {/* --- DANH SÁCH EVENTS TRONG NGÀY --- */}
                        <div className="flex flex-col gap-3">
                          {groupedData[year][month][day].map((event) => (
                            <div
                              key={event.id}
                              className="group flex gap-3 items-start"
                            >
                              {/* Giờ */}
                              <span className="text-xs font-mono text-default-400 mt-1 min-w-[45px]">
                                {formatTime(event.timestamp)}
                              </span>

                              {/* Card nội dung */}
                              <Card
                                shadow="sm"
                                className="w-full hover:scale-[1.01] transition-transform bg-content2/50 dark:dark:bg-slate-900"
                              >
                                <CardBody className="p-3 flex flex-row justify-between gap-2 items-center">
                                  <div>
                                    <p className="font-semibold text-small text-default-800">
                                      {event.title}
                                    </p>
                                    <p className="text-tiny text-default-500 truncate max-w-[300px]">
                                      {event.description}
                                    </p>
                                  </div>
                                  <Chip
                                    size="sm"
                                    color={event.status}
                                    variant="flat"
                                    classNames={{ base: "h-6" }}
                                  >
                                    {event.status}
                                  </Chip>
                                </CardBody>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
