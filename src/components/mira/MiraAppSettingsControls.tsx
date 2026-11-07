import { AiProviderSettings } from "@/components/AiProviderSettings";
import { MiraSpeechPrivacySettings } from "@/components/mira/MiraSpeechPrivacySettings";

export function MiraAppSettingsControls({
  userId,
  onProviderSaved,
}: {
  userId: string;
  onProviderSaved?: () => void;
}) {
  return (
    <>
      <AiProviderSettings userId={userId} onSaved={onProviderSaved} />
      <MiraSpeechPrivacySettings />
    </>
  );
}
