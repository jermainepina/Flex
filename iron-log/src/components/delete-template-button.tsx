"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTemplate } from "@/app/(app)/templates/actions";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDeleting] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">Delete?</span>
      <button
        type="button"
        disabled={deleting}
        onClick={() =>
          startDeleting(async () => {
            await deleteTemplate(templateId);
            router.refresh();
          })
        }
        className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {deleting ? "…" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        No
      </button>
    </span>
  );
}
