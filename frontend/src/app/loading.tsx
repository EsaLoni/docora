import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans select-none">
      <Loader2 className="h-6 w-6 text-gold animate-spin" />
      <div className="text-center space-y-1">
        <p className="font-serif text-title font-medium text-ink">Loading workspace</p>
        <p className="text-caption text-ink-secondary">Retrieving notebook context and documents.</p>
      </div>
    </div>
  );
}
