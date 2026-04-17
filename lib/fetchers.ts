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
// BAZOŠ – pouze byty na prodej v ČB
// ─────────────────────────────────────────────
export async function fetchBazos(): Promise<Listing[]> {
  // rub=re&rubriky=byty = pouze sekce reality/byty
  const url = "https://www.bazos.cz/rss.php?rub=re&hlokalita=České+Budějovice&okruh=0&rubriky=byty";
  const listings: Listing[] = [];

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return listings;
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed?.rss?.channel?.item;
    if (!items) return listings;
    const arr = Array.isArray(items) ? items : [items];

    for (const item of arr) {
      const title: string = item.title || "";
      const link: string = item.link || "";
      const desc: string = item.description || "";

      if (!link) continue;
      if (isPronajemText(title) || isPronajemText(desc)) continue;
      if (isMaj(title) || isMaj(desc)) continue;

      listings.push({
        id: `bazos_${link}`,
        title,
        price: extractPrice(desc || title),
        url: link,
        source: "Bazoš",
        description: stripHtml(desc).slice(0, 200),
        location: "České Budějovice",
      });
    }
  } catch (e) {
    console.error("Bazoš fetch error:", e);
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
          estateType: ["BYT"],
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
        description: (item.note || "").slice(0, 200),
        location: item.locality?.address || "České Budějovice",
      }));
  } catch (e) {
    console.error("Bezrealitky fetch error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
// SREALITY – pouze byty na prodej v ČB
// ─────────────────────────────────────────────
const CATEGORY_SUB: Record<number, string> = {
  2: "1+kk",
  3: "1+1",
  4: "2+kk",
  5: "2+1",
  6: "3+kk",
  7: "3+1",
  8: "4+kk",
  9: "4+1",
  10: "5+kk",
  11: "5+1",
  12: "6-a-vice",
  16: "atypicky",
};

const CB_KEYWORDS = ["české budějovice", "budějovice"];

function isCB(text: string): boolean {
  const lower = text.toLowerCase();
  return CB_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchSreality(): Promise<Listing[]> {
  // category_main_cb=1 = pouze byty
  const url = "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_district_id=1&per_page=60&sort=0";
  const listings: Listing[] = [];

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 RealityWatchdog/1.0",
        Accept: "application/json",
        Referer: "https://www.sreality.cz/",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return listings;
    const data = await res.json();
    const estates = data?._embedded?.estates || [];

    for (const e of estates) {
      const locality: string = e.locality || "";
      if (!isCB(locality)) continue;
      if (isMaj(locality)) continue;

      const hash = e.hash_id;
      if (!hash) continue;

      const name: string = e.name || "Inzerát";
      const priceRaw = e.price_czk?.value_raw;
      const price = priceRaw
        ? `${Number(priceRaw).toLocaleString("cs-CZ")} Kč`
        : "Cena neuvedena";

      const seo = e.seo || {};
      const subCb = seo.category_sub_cb;
      const seoLocality = seo.locality || "ceske-budejovice";
      const subSlug = subCb ? CATEGORY_SUB[subCb] : null;

      let url = `https://www.sreality.cz/detail/prodej/byt`;
      if (subSlug) url += `/${subSlug}`;
      url += `/${seoLocality}/${hash}`;

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

  return listings;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function isMaj(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("máj") || lower.includes("sídliště máj");
}

function isPronajemText(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("pronájem") ||
    lower.includes("pronajm") ||
    lower.includes("k pronájmu") ||
    lower.includes("nájem") ||
    lower.includes("podnájem")
  );
}

function extractPrice(text: string): string {
  const match = text.match(/[\d\s]{4,}[\s]*kč/i);
  return match ? match[0].trim() : "Cena neuvedena";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
