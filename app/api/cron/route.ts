import { NextRequest, NextResponse } from "next/server";
import { fetchBazos, fetchBezrealitky, fetchSreality } from "@/lib/fetchers";
import { filterNewIds } from "@/lib/store";
import { sendNewListingsEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const isAuthorized = authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [bazos, bezrealitky, sreality] = await Promise.allSettled([
      fetchBazos(),
      fetchBezrealitky(),
      fetchSreality(),
    ]);

    const debug = {
      bazos: bazos.status === "fulfilled"
        ? { count: bazos.value.length, sample: bazos.value[0] || null }
        : { error: bazos.reason?.message || String(bazos.reason) },
      bezrealitky: bezrealitky.status === "fulfilled"
        ? { count: bezrealitky.value.length, sample: bezrealitky.value[0] || null }
        : { error: bezrealitky.reason?.message || String(bezrealitky.reason) },
      sreality: sreality.status === "fulfilled"
        ? { count: sreality.value.length, sample: sreality.value[0] || null }
        : { error: sreality.reason?.message || String(sreality.reason) },
    };

    const allListings = [
      ...(bazos.status === "fulfilled" ? bazos.value : []),
      ...(bezrealitky.status === "fulfilled" ? bezrealitky.value : []),
      ...(sreality.status === "fulfilled" ? sreality.value : []),
    ];

    if (allListings.length === 0) {
      return NextResponse.json({ message: "Žádné výsledky", newCount: 0, debug });
    }

    const allIds = allListings.map((l) => l.id);
    const newIds = await filterNewIds(allIds);
    const newListings = allListings.filter((l) => newIds.includes(l.id));

    if (newListings.length > 0) {
      await sendNewListingsEmail(newListings);
    }

    return NextResponse.json({
      success: true,
      total: allListings.length,
      newCount: newListings.length,
      debug,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
