import FlashcardDeckForm from "@/components/flash-card/forms/FlashcardDeckForm";

export default function CreateDeckPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <FlashcardDeckForm />
      </div>
    </div>
  );
}
