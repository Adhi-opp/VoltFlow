import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Base historical volume from off-platform network activity (25 years of NCR
// electrical infrastructure work). Blended into the ticker so day-one organic
// visitors see credible social proof rather than a trivially small number.
const BASE_HISTORICAL_GMV = 1_450_000;

export const getMonthlyGmv = unstable_cache(
  async (): Promise<number> => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const result = await prisma.project.aggregate({
        _sum: { totalEstimate: true },
        where: {
          createdAt: { gte: startOfMonth },
          totalEstimate: { not: null },
        },
      });

      return (result._sum.totalEstimate ?? 0) + BASE_HISTORICAL_GMV;
    } catch {
      // DB unreachable — return base GMV so the ticker still renders
      return BASE_HISTORICAL_GMV;
    }
  },
  ["monthly-gmv"],
  { revalidate: 300 } // 5 minutes
);
