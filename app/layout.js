import "./globals.css";
import CookieConsent from "./components/CookieConsent";

export const metadata = {
  title: "Drilex CDN",
  description: "Personal CDN for logos, favicons and static assets",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CookieConsent matomoSiteId="2" owaSiteId="d7d8416dcabbffe05aa23048dbdd3c9a" clarityProjectId="x1nmcs7xre" />
      </body>
    </html>
  );
}