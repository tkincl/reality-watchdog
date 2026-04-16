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

export async function fetchBazos(): Promise<Listing[]> {
  const urls = [
    "https://reality.bazos.cz/rss.php?rub=&hledat=&irss=&hlokalita=%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&rubriky=byty&posted=",
    "https://reality.bazos.cz/rss.php?rub=&hledat=&irss=&hlokalita=%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&rubriky=domy&posted=",
    "https://reality.bazos.cz/rss.php?rub=&hledat=&irss=&hlokalita=%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&rubriky=pozemky&posted=",
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
        if (isMaj(title) || isMaj(item.description || "")) continue;
        listings.push({
          id: `bazos_${item.link}`,
          title,
          price: extractPrice(item.description || title),
          url: item.link,
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

export async function fetchSreality(): Promise<Listing[]> {
  const endpoints = [
    "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_region_id=10&locality_district_id=42&locality_municipality_id=537&per_page=20&sort=0",
    "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=2&category_type_cb=1&locality_region_id=10&locality_district_id=42&locality_municipality_id=537&per_page=20&sort=0",
    "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=3&category_type_cb=1&locality_region_id=10&locality_district_id=42&locality_municipality_id=537&per_page=20&sort=0",
  ];

  const listings: Listing[] = [];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) continue;
      const data = await res.json();
      const estates = data?._embedded?.estates || [];

      for (const e of estates) {
        const locality: string = e.locality || "";
        if (isMaj(locality)) continue;

        const hash = e.hash_id;
        const name: string = e.name || "Inzerát";
        const priceObj = e.price_czk;
        const price = priceObj?.value_raw
          ? `${Number(priceObj.value_raw).toLocaleString("cs-CZ")} Kč`
          : "Cena neuvedena";

        listings.push({
          id: `sreality_${hash}`,
          title: name,
          price,
          url: `https://www.sreality.cz/detail/${e.seo?.category_main_cb || "byt"}/prodej/${e.seo?.locality || "ceske-budejovice"}/${hash}`,
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

function isMaj(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("máj") || lower.includes("maj ") || lower.includes("sídliště máj");
}

function extractPrice(text: string): string {
  const match = text.match(/[\d\s]{4,}[\s]*kč/i);
  return match ? match[0].trim() : "Cena neuvedena";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
