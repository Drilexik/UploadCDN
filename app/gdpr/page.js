export const metadata = { title: "GDPR & Soukromí — Drilex CDN" };

export default function GdprPage() {
  const sec = { marginBottom: 28 };
  const h2 = { fontSize: 18, fontWeight: 600, color: "var(--text, #ede9ff)", margin: "0 0 8px" };
  const link = { color: "var(--accent2, #a78bfa)", textDecoration: "underline" };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg, #08070f)",
        color: "var(--text2, #b8aee0)",
        padding: "64px 24px",
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
        fontSize: 14,
        lineHeight: 1.65,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/" style={{ ...link, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          ← zpět na upload.drilex.cz
        </a>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text, #ede9ff)", margin: "24px 0 6px" }}>
          Ochrana soukromí &amp; GDPR
        </h1>
        <p style={{ color: "var(--muted, #5e5480)", marginBottom: 40 }}>
          Co o vás sbíráme a jak s tím nakládáme.
        </p>

        <div style={sec}>
          <h2 style={h2}>Co sbíráme</h2>
          <p style={{ margin: 0 }}>
            Používáme vlastní self-hosted analytiku (Matomo a Open Web Analytics) ke zlepšování
            služby. Sbíráme anonymní údaje: zobrazené stránky, čas na webu, kliknutí a pohyb
            (heatmapy), zdroj návštěvy, typ zařízení/prohlížeče a přibližnou lokalitu z
            anonymizované IP.
          </p>
        </div>

        <div style={sec}>
          <h2 style={h2}>Kde jsou data uložena</h2>
          <p style={{ margin: 0 }}>
            Veškerá data běží na našich vlastních serverech (matomo.drilex.cz a owa.drilex.cz).
            Nesdílíme je s žádnou třetí stranou a nepoužíváme reklamní sítě. IP adresa je
            anonymizovaná.
          </p>
        </div>

        <div style={sec}>
          <h2 style={h2}>Cookies a souhlas</h2>
          <p style={{ margin: 0 }}>
            Analytické cookies se načtou až po vašem souhlasu. Bez souhlasu se nic netrackuje —
            ukládáme pouze vaši volbu souhlasu.
          </p>
        </div>

        <div style={sec}>
          <h2 style={h2}>Vaše práva</h2>
          <p style={{ margin: 0 }}>
            Souhlas můžete kdykoli odvolat smazáním cookies prohlížeče. Máte právo na přístup k
            údajům, jejich opravu i výmaz. Napište nám na{" "}
            <a href="mailto:contact@drilex.cz" style={link}>
              contact@drilex.cz
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}