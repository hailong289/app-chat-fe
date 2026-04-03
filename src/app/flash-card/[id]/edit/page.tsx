"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import FlashcardDeckForm from "@/components/flash-card/forms/FlashcardDeckForm";
import { flashcardService } from "@/service/flashcard.service";
import { FlashcardDeck } from "@/types/flashcard.type";

export default function EditDeckPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchDeck = async () => {
      try {
        const response = await flashcardService.getListDeck();
        const found = response.find((d: FlashcardDeck) => d.deck_id === id);
        
        if (found) {
          setDeck(found);
        } else {
          // You could also show a 404 or redirect here if not found
          console.error("Deck not found locally");
          router.push("/flash-card");
        }
      } catch (error) {
        console.error("Error fetching deck:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeck();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <FlashcardDeckForm initialData={deck || undefined} />
      </div>
    </div>
  );
}
