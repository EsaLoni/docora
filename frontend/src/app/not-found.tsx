import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 max-w-md mx-auto text-center px-4">
      <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <FileQuestion className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Page Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested document view or workspace page does not exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
