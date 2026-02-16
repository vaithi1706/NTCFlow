import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl">🔍</div>
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <p className="text-lg text-muted-foreground">
            Page not found. The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            href="/home"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Go Home
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors"
          >
            Landing Page
          </Link>
        </div>
        <div className="flex items-center gap-2 justify-center pt-4">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">DK</div>
          <span className="text-sm text-muted-foreground">DKFlow</span>
        </div>
      </div>
    </div>
  );
}
