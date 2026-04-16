import { Resend } from "resend";
import { Listing } from "./fetchers";

const resend = new Resend(process.env.RESEND_API_KEY);
const RECIPIENT = "tkincl@seznam.cz";
const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";

export async function sendNewListingsEmail(listings: Listing[]): Promise<void> {
  if (listings.length === 0) return;

  const subject =
    listings.length === 1
      ? `🏠 Nový inzerát: ${listings[0].title}`
      : `🏠 ${listings.length} nových inzerátů – České Budějovice`;

  const html = buildEmailHtml(listings);

  await resend.emails.send({
    from: FROM,
    to: RECIPIENT,
    subject,
    html,
  });

  console.log(`📧 Email odeslán: ${listings.length} inzerátů`);
}

function buildEmailHtml(listings: Listing[]): string {
  const cards = listings
    .map(
      (l) => `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <span style="background:${sourceColor(l.source)};color:white;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;font-family:sans-serif;">${l.source}</span>
        <span style="font-size:18px;font-weight:700;color:#111;font-family:sans-serif;">${l.price}</span>
      </div>
      <h2 style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#111;font-family:sans-serif;">${l.title}</h2>
      ${l.location ? `<p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;font-family:sans-serif;">📍 ${l.location}</p>` : ""}
      ${l.description ? `<p style="margin:0 0 14px 0;font-size:13px;color:#374151;font-family:sans-serif;">${l.description}…</p>` : ""}
      <a href="${l.url}" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;font-family:sans-serif;">Zobrazit inzerát →</a>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);border-radius:16px;padding:28px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🏠</div>
      <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:white;font-family:sans-serif;">Reality Hlídač – České Budějovice</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);font-family:sans-serif;">${listings.length} nových inzerátů</p>
    </div>
    ${cards}
    <p style="text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;">Reality hlídač • Bazoš, Bezrealitky, Sreality</p>
  </div>
</body></html>`;
}

function sourceColor(source: string): string {
  switch (source) {
    case "Bazoš": return "#16a34a";
    case "Bezrealitky": return "#dc2626";
    case "Sreality": return "#2563eb";
    default: return "#6b7280";
  }
}
