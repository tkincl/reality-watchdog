import { parseStringPromise } from "xml2js";

export interface Listing {
  id: string;
  title: string;
  price: string;
  url: string;
  source: string;
  description?: string;
  location?: string;
}

// ─────────────────────────────────────────────
// BAZOŠ – RSS feed
// ─────────────────────────────────────────────
export async function fetchBazos(): Promise<Listing[]> {
  const urls = [
    "https://www.bazos.cz/rss.php?rub=re&hlokalita=České+Budějovice&okruh=0",
  ];

  const listings: Listing[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0" },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const items = parsed?.rss?.channel?.item;
      if (!items) continue;
      const arr = Array.isArray(items) ? items : [items];

      for (const item of arr) {
        const title: string = item.title || "";
        const link: string = item.link || "";
        if (!link) continue;
        if (isMaj(title) || isMaj(item.description || "")) continue;

        listings.push({
          id: `bazos_${link}`,
          title,
          price: extractPrice(item.description || title),
          url: link,
          source: "Bazoš",
          description: stripHtml(item.description || "").slice(0, 200),
          location: "České Budějovice",
        });
      }
    } catch (e) {
      console.error("Bazoš fetch error:", e);
    }
  }

  return listings;
}

// ─────────────────────────────────────────────
// BEZREALITKY – GraphQL API
// ─────────────────────────────────────────────
export async function fetchBezrealitky(): Promise<Listing[]> {
  const query = `
    query AdvertList($regionOsmIds: [ID!], $offerType: OfferType!, $estateType: [EstateType!]) {
      advertList(
        regionOsmIds: $regionOsmIds
        offerType: $offerType
        estateType: $estateType
        limit: 20
        order: CREATED_AT_DESC
      ) {
        list {
          id
          uri
          name
          price
          currency
          note
          locality {
            address
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://www.bezrealitky.cz/api/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0",
      },
      body: JSON.stringify({
        query,
        variables: {
          regionOsmIds: ["R442469"],
          offerType: "PRODEJ",
          estateType: ["BYT", "DUM", "POZEMEK", "KOMERCNI"],
        },
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data?.data?.advertList?.list || [];

    return list
      .filter((item: any) => !isMaj(item.locality?.address || ""))
      .map((item: any) => ({
        id: `bezrealitky_${item.id}`,
        title: item.name || "Inzerát",
        price: item.price
          ? `${Number(item.price).toLocaleString("cs-CZ")} ${item.currency || "Kč"}`
          : "Cena neuvedena",
        url: `https://www.bezrealitky.cz/${item.uri}`,
        source: "Bezrealitky",
        description: item.note?.slice(0, 200),
        location: item.locality?.address || "České Budějovice",
      }));
  } catch (e) {
    console.error("Bezrealitky fetch error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
// SREALITY – locality_district_id=1 = okres České Budějovice
// ─────────────────────────────────────────────
const CB_KEYWORDS = ["české budějovice", "budějovice"];

function isCB(text: string): boolean {
  const lower = text.toLowerCase();
  return CB_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchSreality(): Promise<Listing[]> {
  const BASE = "https://www.sreality.cz/api/cs/v2/estates";
  // locality_district_id=1 = okres České Budějovice (správné ID!)
  const PARAMS = "category_type_cb=1&locality_district_id=1&per_page=60&sort=0";

  const endpoints = [
    `${BASE}?category_main_cb=1&${PARAMS}`, // byty
    `${BASE}?category_main_cb=2&${PARAMS}`, // domy
    `${BASE}?category_main_cb=3&${PARAMS}`, // pozemky
  ];

  const categorySlug: Record<number, string> = {
    0: "byty",
    1: "domy",
    2: "pozemky",
  };

  const listings: Listing[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    try {
      const res = await fetch(endpoints[i], {
        headers: {
          "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0",
          Accept: "application/json",
          Referer: "https://www.sreality.cz/",
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) continue;
      const data = await res.json();
      const estates = data?._embedded?.estates || [];

      for (const e of estates) {
        const locality: string = e.locality || "";
        // Filtrujeme pouze město České Budějovice, ne okolní obce
        if (!isCB(locality)) continue;
        if (isMaj(locality)) continue;

        const hash = e.hash_id;
        if (!hash) continue;

        const name: string = e.name || "Inzerát";
        const priceRaw = e.price_czk?.value_raw;
        const price = priceRaw
          ? `${Number(priceRaw).toLocaleString("cs-CZ")} Kč`
          : "Cena neuvedena";

        const cat = categorySlug[i];
        const seoLocality = e.seo?.locality || "ceske-budejovice";
        const seoCategory = e.seo?.category_main_cb || cat;
        const url = `https://www.sreality.cz/detail/${seoCategory}/prodej/${seoLocality}/${hash}`;

        listings.push({
          id: `sreality_${hash}`,
          title: name,
          price,
          url,
          source: "Sreality",
          description: e.meta_description?.slice(0, 200),
          location: locality,
        });
      }
    } catch (e) {
      console.error("Sreality fetch error:", e);
    }
  }

  return listings;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function isMaj(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("máj") || lower.includes("sídliště máj");
}

function extractPrice(text: string): string {
  const match = text.match(/[\d\s]{4,}[\s]*kč/i);
  return match ? match[0].trim() : "Cena neuvedena";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
