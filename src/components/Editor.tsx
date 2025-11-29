// src/components/Editor.tsx
"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCreateBlockNote, usePrefersColorScheme } from "@blocknote/react";
import { BlockNoteView,  } from "@blocknote/mantine";

export default function Editor() {
  const editor = useCreateBlockNote();
 
  return (
    <div className="border rounded-md">
      <BlockNoteView editor={editor}  />
    </div>
  );
}
