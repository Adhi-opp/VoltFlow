import Link from "next/link";
import { ArrowRight, House, Store } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">WireMart</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Choose your path to start: estimate projects as a homeowner or bid as a dealer.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <Link href="/register?role=HOMEOWNER" className="group">
          <Card className="h-full border-2 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <House className="h-4 w-4" />
              </div>
              <CardTitle>I am a Homeowner</CardTitle>
              <CardDescription>
                Calculate estimates and find verified dealers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm font-medium text-primary">
              Continue as Homeowner
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/register?role=DEALER" className="group">
          <Card className="h-full border-2 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Store className="h-4 w-4" />
              </div>
              <CardTitle>I am a Dealer</CardTitle>
              <CardDescription>
                Bid on verified electrical projects.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm font-medium text-primary">
              Continue as Dealer
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
