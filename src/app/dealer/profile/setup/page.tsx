"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  saveDealerProfileAction,
  type DealerProfileInput,
} from "@/features/dealer/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DealerProfileSetupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<DealerProfileInput>({
    companyName: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    serviceAreas: "",
    brandsSold: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated" && session?.user?.role !== "DEALER" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  function update(field: keyof DealerProfileInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await saveDealerProfileAction(form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dealer/dashboard"), 1200);
    });
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center px-4">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Set Up Your Dealer Profile</CardTitle>
          <CardDescription>
            Complete your business details to start receiving quote requests from
            homeowners in your area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Profile saved! Redirecting to dashboard...
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN (optional)</Label>
              <Input
                id="gstin"
                placeholder="22AAAAA0000A1Z5"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value)}
                maxLength={15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={form.pincode}
                onChange={(e) => update("pincode", e.target.value)}
                maxLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceAreas">
                Service Areas{" "}
                <span className="text-xs text-muted-foreground">
                  (comma-separated city names)
                </span>
              </Label>
              <Input
                id="serviceAreas"
                placeholder="Delhi, Noida, Ghaziabad"
                value={form.serviceAreas}
                onChange={(e) => update("serviceAreas", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandsSold">
                Brands Sold{" "}
                <span className="text-xs text-muted-foreground">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="brandsSold"
                placeholder="Polycab, Finolex, Havells"
                value={form.brandsSold}
                onChange={(e) => update("brandsSold", e.target.value)}
                required
              />
            </div>

            <Button className="w-full" type="submit" disabled={isPending || success}>
              {isPending ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
