"use client";

import { useEffect, useRef, useState } from "react";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { CommentsExtension } from "@blocknote/core/comments";
import { posToDOMRect } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Button, Textarea } from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

/**
 * Custom new-comment popup. Replaces BlockNote's FloatingComposerController
 * because that one breaks: BlockNote registers `editor.onSelectionChange` to
 * auto-clear `pendingComment` whenever the prosemirror selection changes
 * (see @blocknote/core/dist/comments.js — `p.setState({pendingComment:!1})`
 * inside the onSelectionChange callback). When the user clicks the popup's
 * sub-editor, the main editor blurs, selection collapses, the listener
 * fires, pendingComment goes false, and the popup unmounts mid-typing.
 *
 * This implementation tracks visibility with LOCAL state (decoupled from
 * `pendingComment`) and saves the original selection in a ref so we can
 * restore it before calling `createThread`, which reads selection from the
 * editor at call time to anchor the new thread.
 *
 * Must be rendered inside <BlockNoteView> so `useBlockNoteEditor`,
 * `useExtension`, and `useExtensionState` resolve from BlockNoteContext.
 */
export function NewCommentPopover() {
  const { t } = useTranslation();
  const editor = useBlockNoteEditor<any, any, any>() as any;
  const comments = useExtension(CommentsExtension) as any;

  // Subscribe only to detect the false→true transition; we don't render
  // based on this directly.
  const pendingComment = useExtensionState(CommentsExtension, {
    editor,
    selector: (s: any) => s.pendingComment,
  });

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<
    { top: number; left: number } | null
  >(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const savedSelRef = useRef<{ from: number; to: number } | null>(null);
  const wasOpenRef = useRef(false);

  // Detect toolbar's startPendingComment(). Snapshot selection + open popup.
  // Skip if popup is already open (re-entry from our own restore call).
  useEffect(() => {
    if (!pendingComment || !editor || wasOpenRef.current) return;
    const view = editor.prosemirrorView;
    if (!view) return;
    const sel = view.state.selection;
    savedSelRef.current = { from: sel.from, to: sel.to };

    const rect = posToDOMRect(view, sel.from, sel.to);
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setOpen(true);
    wasOpenRef.current = true;
  }, [pendingComment, editor]);

  const close = () => {
    setOpen(false);
    setDraft("");
    setPosition(null);
    savedSelRef.current = null;
    wasOpenRef.current = false;
    try {
      comments?.stopPendingComment();
    } catch {
      // ignore
    }
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || !comments || !editor || !savedSelRef.current) return;

    setSubmitting(true);
    try {
      const view = editor.prosemirrorView;
      const { from, to } = savedSelRef.current;

      // Restore selection — `createThread` reads `view.state.selection` to
      // anchor the new thread, so the original highlighted range must be
      // active at call time.
      const tr = view.state.tr.setSelection(
        TextSelection.create(view.state.doc, from, to),
      );
      view.dispatch(tr);

      // Re-arm pendingComment if BlockNote had cleared it during blur.
      if (typeof comments.startPendingComment === "function") {
        try {
          comments.startPendingComment();
        } catch {
          // ignore
        }
      }

      await comments.createThread({
        initialComment: {
          body: [
            {
              type: "paragraph",
              content: [{ type: "text", text, styles: {} }],
            },
          ],
        },
      });

      close();
    } catch (err) {
      console.error("[comments] createThread failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Escape closes the popup.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !position) return null;

  return (
    <div
      className="fixed z-50 w-80 rounded-lg border border-default-200 dark:border-gray-700 bg-content1 shadow-lg p-3"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => {
        // Prevent the click from reaching the editor (which would change
        // selection and clear the highlighted range we still want).
        e.stopPropagation();
      }}
    >
      <Textarea
        autoFocus
        value={draft}
        onValueChange={setDraft}
        placeholder={t("docs.commentPlaceholder")}
        minRows={2}
        maxRows={6}
        variant="flat"
        classNames={{
          inputWrapper: "bg-transparent shadow-none px-0",
        }}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !submitting &&
            draft.trim()
          ) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button
          size="sm"
          variant="light"
          isIconOnly
          onPress={close}
          aria-label={t("common.cancel")}
        >
          <XMarkIcon className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          color="primary"
          onPress={handleSubmit}
          isDisabled={!draft.trim() || submitting}
          isLoading={submitting}
        >
          {t("common.send")}
        </Button>
      </div>
    </div>
  );
}
