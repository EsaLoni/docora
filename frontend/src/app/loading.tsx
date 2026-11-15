import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Loading Docora workspace...</p>
        <p className="text-xs text-muted-foreground">Your documents. Your intelligence.</p>
      </div>
    </div>
  );
}
