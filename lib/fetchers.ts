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
// BAZOŠ – byty na prodej v ČB
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
      if (isPoptavka(titleLower) || isPoptavka(descLower)) continue;
      if (isMaj(titleLower)) continue;
      if (isNesmysl(titleLower)) continue;
      if (isDruzstvo(titleLower, descLower)) continue;
      if (!isBytVTitulku(titleLower)) continue;

      // Filtr na cenu — pokud je cena uvedena a je pod 500 000, jde o pronájem
      const priceNum = extractPriceNumber(title + " " + desc);
      if (priceNum !== null && priceNum < 500000) continue;

      listings.push({
        id: `bazos_${link}`,
        title,
        price: priceNum ? `${priceNum.toLocaleString("cs-CZ")} Kč` : "Cena neuvedena",
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
// SREALITY – byty na prodej v ČB
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
  const url = "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_district_id=1&per_page=60&sort=0";
  const listings: Listing[] = [];

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.sreality.cz/hledani/prodej/byty/ceske-budejovice",
        "Accept-Language": "cs-CZ,cs;q=0.9",
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
      const nameLower = name.toLowerCase();
      const metaLower = (e.meta_description || "").toLowerCase();
      if (isDruzstvo(nameLower, metaLower)) continue;

      const priceRaw = e.price_czk?.value_raw;
      if (priceRaw && priceRaw < 500000) continue;
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
    text.includes("přenájem") ||
    text.includes("prenájem") ||
    text.includes("prenajm") ||
    text.includes("prenájom") ||
    text.includes("prenajom") ||
    text.includes("k pronájmu") ||
    text.includes("nájem") ||
    text.includes("podnájem") ||
    text.includes("ubytování") ||
    text.includes("ubytovani") ||
    text.includes("pokoj") ||
    text.includes("lůžko") ||
    text.includes("luzko")
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
    text.includes("poptavam") ||
    text.includes("sháním") ||
    text.includes("shanim") ||
    text.includes("mám zájem") ||
    text.includes("chtěl bych") ||
    text.includes("chtel bych") ||
    text.includes("hledáme") ||
    text.includes("hledame")
  );
}

function isNesmysl(text: string): boolean {
  return (
    text.includes("kontejner") ||
    text.includes("mobilheim") ||
    text.includes("mobilhome") ||
    text.includes("sklad") ||
    text.includes("kancelář") ||
    text.includes("kancelar") ||
    text.includes("pozemek") ||
    text.includes("parcela") ||
    text.includes("rodinný") ||
    text.includes("rodinny") ||
    text.includes("garáž") ||
    text.includes("garaz") ||
    text.includes("chalupa") ||
    text.includes("chata") ||
    text.includes("vila ") ||
    text.includes("apartmán") ||
    text.includes("apartman") ||
    text.includes("příprava nemovitosti") ||
    text.includes("priprava nemovitosti") ||
    text.includes("realitní") ||
    text.includes("realitni") ||
    text.includes("dům ") ||
    text.includes("dum ")
  );
}

function isBytVTitulku(title: string): boolean {
  return (
    title.includes("prodej bytu") ||
    title.includes("prodej byt") ||
    title.includes("byt na prodej") ||
    title.includes("byt ") ||
    title.includes("1+kk") ||
    title.includes("2+kk") ||
    title.includes("3+kk") ||
    title.includes("4+kk") ||
    title.includes("5+kk") ||
    title.includes("1+1") ||
    title.includes("2+1") ||
    title.includes("3+1") ||
    title.includes("4+1") ||
    title.includes("garsonka") ||
    title.includes("garsoniera") ||
    title.includes("garsoniéra")
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

function extractPriceNumber(text: string): number | null {
  // Hledáme číslo následované "kč" nebo za dvojtečkou na konci titulku
  const match = text.match(/:\s*([\d\s]+)\s*$/i) || text.match(/([\d\s]{5,})\s*kč/i);
  if (!match) return null;
  const num = parseInt(match[1].replace(/\s/g, ""), 10);
  return isNaN(num) ? null : num;
}

function extractPrice(text: string): string {
  const num = extractPriceNumber(text);
  return num ? `${num.toLocaleString("cs-CZ")} Kč` : "Cena neuvedena";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
