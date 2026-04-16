import { NextRequest, NextResponse } from "next/server";
import { sendNewListingsEmail } from "@/lib/email";
import { Listing } from "@/lib/fetchers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testListings: Listing[] = [
    {
      id: "test_1",
      title: "Prodej bytu 3+1, 72 m², centrum Českých Budějovic",
      price: "3 850 000 Kč",
      url: "https://www.sreality.cz",
      source: "Sreality",
      description: "Krásný prostorný byt v centru města, cihla, po rekonstrukci, výtah, balkon.",
      location: "Piaristická, České Budějovice 1",
    },
    {
      id: "test_2",
      title: "Rodinný dům 4+1 se zahradou, Suché Vrbné",
      price: "7 200 000 Kč",
      url: "https://www.bezrealitky.cz",
      source: "Bezrealitky",
      description: "Samostatný RD, 180 m², pozemek 650 m², garáž, klidná lokalita.",
      location: "Suché Vrbné, České Budějovice",
    },
    {
      id: "test_3",
      title: "Prodej bytu 2+kk, 48 m², OV, rekonstrukce",
      price: "2 490 000 Kč",
      url: "https://reality.bazos.cz",
      source: "Bazoš",
      description: "Přímo od majitele, bez provize, nová kuchyň, zděný dům.",
      location: "Čtyři Dvory, České Budějovice",
    },
  ];

  await sendNewListingsEmail(testListings);
  return NextResponse.json({ success: true, sent: testListings.length });
}
