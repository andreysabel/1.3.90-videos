import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { getCollections } from "@/lib/mongodb";
import type { DashboardStats } from "@/lib/types";

/**
 * GET /api/dashboard
 * Pipeline de agregación sobre los metadatos del usuario:
 * - totales: nº de vídeos, suma de `tamano` y tamaño medio.
 * - topTags: los 8 tags más usados.
 * $facet ejecuta ambos cálculos en una sola pasada por la colección.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { videos } = await getCollections();
  const [result] = await videos
    .aggregate<{
      totals: { totalVideos: number; totalBytes: number; avgBytes: number }[];
      topTags: { tag: string; count: number }[];
    }>([
      { $match: { userId: user.id } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalBytes: { $sum: "$tamano" },
                avgBytes: { $avg: "$tamano" },
              },
            },
            { $project: { _id: 0 } },
          ],
          topTags: [
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 8 },
            { $project: { _id: 0, tag: "$_id", count: 1 } },
          ],
        },
      },
    ])
    .toArray();

  const totals = result?.totals[0];
  const stats: DashboardStats = {
    totalVideos: totals?.totalVideos ?? 0,
    totalBytes: totals?.totalBytes ?? 0,
    avgBytes: Math.round(totals?.avgBytes ?? 0),
    topTags: result?.topTags ?? [],
  };
  return NextResponse.json(stats);
}
