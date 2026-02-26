"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

interface AppSessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function AppSessionProvider({ children, session }: AppSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
