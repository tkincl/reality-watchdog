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
// BAZOŠ – byty na prodej v ČB, OV
// ─────────────────────────────────────────────
export async function fetchBazos(): Promise<Listing[]> {
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
      const titleLower = title.toLowerCase();
      const descLower = desc.toLowerCase();

      if (!link) continue;
      if (isPronajemText(titleLower) || isPronajemText(descLower)) continue;
      if (isMaj(titleLower) || isMaj(descLower)) continue;
      if (isPoptavka(titleLower) || isPoptavka(descLower)) continue;
      if (isNesmysl(titleLower) || isNesmysl(descLower)) continue;
      if (!isByt(titleLower) && !isByt(descLower)) continue;
      if (isDruzstvo(titleLower, descLower)) continue;

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
// SREALITY – byty OV na prodej v ČB
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
  const url = "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_district_id=1&ownership=1&per_page=60&sort=0";
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
      if (isMaj(locality.toLowerCase())) continue;

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

      let detailUrl = `https://www.sreality.cz/detail/prodej/byt`;
      if (subSlug) detailUrl += `/${subSlug}`;
      detailUrl += `/${seoLocality}/${hash}`;

      listings.push({
        id: `sreality_${hash}`,
        title: name,
        price,
        url: detailUrl,
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
  return text.includes("máj") || text.includes("sídliště máj");
}

function isPronajemText(text: string): boolean {
  return (
    text.includes("pronájem") ||
    text.includes("pronajm") ||
    text.includes("k pronájmu") ||
    text.includes("nájem") ||
    text.includes("podnájem")
  );
}

function isPoptavka(text: string): boolean {
  return (
    text.includes("hledám") ||
    text.includes("hledam") ||
    text.includes("koupím") ||
    text.includes("koupim") ||
    text.includes("nabídněte") ||
    text.includes("nabidnete") ||
    text.includes("poptávám") ||
    text.includes("sháním") ||
    text.includes("shanim") ||
    text.includes("mám zájem") ||
    text.includes("chtěl bych koupit") ||
    text.includes("chtel bych")
  );
}

function isNesmysl(text: string): boolean {
  return (
    text.includes("kontejner") ||
    text.includes("sklad") ||
    text.includes("kancelář") ||
    text.includes("kancelar") ||
    text.includes("pozemek") ||
    text.includes("parcela") ||
    text.includes("rodinný") ||
    text.includes("garáž") ||
    text.includes("garaz") ||
    text.includes("chalupa") ||
    text.includes("chata") ||
    text.includes("vila ")
  );
}

function isByt(text: string): boolean {
  return (
    text.includes("byt") ||
    text.includes("1+kk") ||
    text.includes("2+kk") ||
    text.includes("3+kk") ||
    text.includes("4+kk") ||
    text.includes("1+1") ||
    text.includes("2+1") ||
    text.includes("3+1") ||
    text.includes("4+1") ||
    text.includes("garsonka") ||
    text.includes("garsoniera")
  );
}

function isDruzstvo(title: string, desc: string): boolean {
  const hasDruzstvo =
    title.includes("družstevní") ||
    title.includes("druzstevni") ||
    title.includes("družstvo") ||
    desc.includes("družstevní") ||
    desc.includes("druzstevni");

  const hasOV =
    title.includes("osobní vlastnictví") ||
    title.includes("osobni vlastnictvi") ||
    title.includes("ov)") ||
    title.includes("(ov") ||
    desc.includes("osobní vlastnictví") ||
    desc.includes("osobni vlastnictvi");

  return hasDruzstvo && !hasOV;
}

function extractPrice(text: string): string {
  const match = text.match(/[\d\s]{4,}[\s]*kč/i);
  return match ? match[0].trim() : "Cena neuvedena";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
