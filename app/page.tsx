export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "24px",
    }}>
      <div style={{ textAlign: "center", color: "white", maxWidth: "480px" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🏠</div>
        <h1 style={{
          fontSize: "32px",
          fontWeight: "800",
          margin: "0 0 8px",
          background: "linear-gradient(to right, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Reality Hlídač
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "16px", margin: "0 0 32px" }}>
          Hlídám Bazoš, Bezrealitky & Sreality.<br />
          Nové inzeráty z Českých Budějovic ti pošlu emailem.
        </p>
        <div style={{
          background: "rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { icon: "🟢", label: "Bazoš", desc: "RSS feed" },
              { icon: "🟢", label: "Bezrealitky", desc: "API" },
              { icon: "🟢", label: "Sreality", desc: "JSON API" },
            ].map((s) => (
              <div key={s.label} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}>
                <span style={{ fontSize: "14px", color: "#e2e8f0" }}>
                  {s.icon} {s.label}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{s.desc}</span>
              </div>
            ))}
          </div>
          <p style={{
            margin: "16px 0 0",
            fontSize: "13px",
            color: "#64748b",
          }}>
            📧 Notifikace → tkincl@seznam.cz
          </p>
        </div>
      </div>
    </main>
  );
}
