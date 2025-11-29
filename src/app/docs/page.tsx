import { DynamicEditor } from "@/components/DynamicEditor";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function DocsPage() {
  return (
    <main className="p-4  min-h-screen ">
      <h1 className="text-xl font-semibold mb-4">Tài liệu</h1>
      <ThemeSwitcher />
      <DynamicEditor />
    </main>
  );
}
