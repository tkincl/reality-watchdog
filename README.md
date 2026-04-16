# 🏠 Reality Hlídač – České Budějovice

## Rychlý návod k nasazení

### 1. npm install
```
npm install
```

### 2. Nahraj na GitHub a připoj k Vercelu
- Nový repozitář na github.com
- Vercel → Add New Project → vyber repozitář → Deploy

### 3. Vercel KV databáze
Vercel Dashboard → Storage → Create Database → KV → pojmenuj "reality-kv" → Connect k projektu

### 4. Environment Variables na Vercelu
Settings → Environment Variables:
- RESEND_API_KEY = tvůj klíč z resend.com
- RESEND_FROM = onboarding@resend.dev (nebo vlastní doména)
- CRON_SECRET = libovolné heslo (např. "mujTajnyKlic2024")

Po uložení: Deployments → Redeploy

### 5. cron-job.org (každých 5 minut, zdarma)
- URL: https://TVOJE-URL.vercel.app/api/cron
- Header: Authorization = Bearer mujTajnyKlic2024
- Interval: every 5 minutes

### 6. Test emailu
Otevři v prohlížeči nebo přes curl:
https://TVOJE-URL.vercel.app/api/test-email
(vyžaduje Authorization header – použij curl nebo Postman)
