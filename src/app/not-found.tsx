import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go Home</Link>
      </Button>
    </main>
  );
}
