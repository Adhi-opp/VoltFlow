"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const router = useRouter();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-slate-50/85 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          PHASEZERO
        </Link>

        <nav className="flex items-center gap-2">
          {/* Always reachable: the calculator is the product, not a member
              feature. Dealers are the exception — they quote, they do not
              create estimates. */}
          {session?.user?.role !== "DEALER" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/calculator">Calculator</Link>
            </Button>
          )}

          {status === "authenticated" && (
            <>
              {session?.user?.role === "ADMIN" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut({ callbackUrl: "/login" });
                  router.refresh();
                }}
              >
                Sign Out
              </Button>
            </>
          )}
          {status === "unauthenticated" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
