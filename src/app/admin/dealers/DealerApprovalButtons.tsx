"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveDealerAction,
  rejectDealerAction,
} from "@/features/admin/actions";

interface Props {
  dealerProfileId: string;
}

export function DealerApprovalButtons({ dealerProfileId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle(action: "approve" | "reject") {
    startTransition(async () => {
      const fn =
        action === "approve" ? approveDealerAction : rejectDealerAction;
      const result = await fn(dealerProfileId);
      if (!result.success) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => handle("approve")}
      >
        {isPending ? "..." : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => handle("reject")}
      >
        {isPending ? "..." : "Reject"}
      </Button>
    </div>
  );
}
