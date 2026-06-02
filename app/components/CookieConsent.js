"use client";
import { useEffect, useState } from "react";

const MATOMO_URL = "https://matomo.drilex.cz/";
const OWA_URL = "https://owa.drilex.cz/";

function loadMatomo(siteId) {
  if (window.__matomoLoaded) return;
  window.__matomoLoaded = true;
  const _paq = (window._paq = window._paq || []);
  _paq.push(["setTrackerUrl", MATOMO_URL + "matomo.php"]);
  _paq.push(["setSiteId", siteId]);
  _paq.push(["enableLinkTracking"]);
  _paq.push(["enableHeartBeatTimer"]);
  _paq.push(["enableJSErrorTracking"]);
  _paq.push(["trackVisibleContentImpressions"]);
  _paq.push(["trackPageView"]);
  const g = document.createElement("script");
  g.async = true;
  g.src = MATOMO_URL + "matomo.js";
  document.head.appendChild(g);
}

function loadOwa(siteId) {
  if (window.__owaLoaded) return;
  window.__owaLoaded = true;
  window.owa_baseUrl = OWA_URL;
  const owa_cmds = (window.owa_cmds = window.owa_cmds || []);
  owa_cmds.push(["setSiteId", siteId]);
  owa_cmds.push(["trackPageView"]);
  owa_cmds.push(["trackClicks"]);
  owa_cmds.push(["trackDomStream"]);
  const s = document.createElement("script");
  s.async = true;
  s.src = OWA_URL + "modules/base/js/owa.tracker-combined-min.js";
  document.head.appendChild(s);
}

export default function CookieConsent({ matomoSiteId, owaSiteId }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let consent = null;
    try {
      consent = localStorage.getItem("drilex_consent");
    } catch (e) {}
    if (consent === "accepted") {
      loadMatomo(matomoSiteId);
      loadOwa(owaSiteId);
    } else if (consent !== "declined") {
      setShow(true);
    }
  }, [matomoSiteId, owaSiteId]);

  const accept = () => {
    try {
      localStorage.setItem("drilex_consent", "accepted");
    } catch (e) {}
    loadMatomo(matomoSiteId);
    loadOwa(owaSiteId);
    setShow(false);
  };
  const decline = () => {
    try {
      localStorage.setItem("drilex_consent", "declined");
    } catch (e) {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 9999,
        maxWidth: 340,
        background: "var(--surface, #110f1e)",
        color: "var(--text, #ede9ff)",
        border: "1px solid var(--border, #2a2545)",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 8px 30px rgba(0,0,0,.5)",
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>🍪 Cookies &amp; soukromí</div>
      <div style={{ color: "var(--text2, #b8aee0)", marginBottom: 12 }}>
        Používáme vlastní analytiku (Matomo &amp; OWA) ke zlepšení webu. Souhlasíš se sběrem
        anonymních statistik?{" "}
        <a href="/gdpr" style={{ color: "var(--accent2, #a78bfa)", textDecoration: "underline" }}>
          Více info
        </a>
        .
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={accept}
          style={{
            flex: 1,
            background: "var(--accent, #8b5cf6)",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Přijmout
        </button>
        <button
          onClick={decline}
          style={{
            flex: 1,
            background: "transparent",
            color: "var(--text2, #b8aee0)",
            border: "1px solid var(--border, #2a2545)",
            borderRadius: 9,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Odmítnout
        </button>
      </div>
    </div>
  );
}