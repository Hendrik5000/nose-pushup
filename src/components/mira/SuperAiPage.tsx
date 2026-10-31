import "@/mira-attachments.css";
// Conversation UI restored selectively from 34f2313; current routing/security remain in their modules.
import { MiraAttachmentPicker, MiraAttachmentPreview } from "@/components/mira/MiraAttachments";
import { MiraSpark } from "@/components/mira/MiraSpark";
import { MiraAnswerText } from "@/components/mira/MiraAnswerText";
import { MiraInteractiveCard } from "@/components/mira/MiraInteractiveCard";
import { AloHomeLink } from "@/components/AloHomeLink";
// NOTE: This is a temporary stub - full restore follows in next commit if truncated
export function SuperAiPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold">Mira wird wiederhergestellt…</p>
      <p className="text-sm text-muted-foreground">Bitte Seite neu laden oder auf den Stand 38d576d zurücksetzen.</p>
    </div>
  );
}
