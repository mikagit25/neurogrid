import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="NeuroGrid" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NeuroGrid" />
        <meta name="description" content="Democratizing AI computing through decentralized GPU networks" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3b82f6" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png" />

        {/* Apple Splash Screens */}
        <link
          href="/apple-splash-2048-2732.png"
          sizes="2048x2732"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-1668-2224.png"
          sizes="1668x2224"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-1536-2048.png"
          sizes="1536x2048"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-1125-2436.png"
          sizes="1125x2436"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-1242-2208.png"
          sizes="1242x2208"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-750-1334.png"
          sizes="750x1334"
          rel="apple-touch-startup-image"
        />
        <link
          href="/apple-splash-640-1136.png"
          sizes="640x1136"
          rel="apple-touch-startup-image"
        />

        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="http://localhost:3001" />
        <link rel="dns-prefetch" href="http://localhost:3001" />

        {/* Security Headers */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws://localhost:3001 http://localhost:3001; font-src 'self'; media-src 'self';" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="NeuroGrid - Decentralized AI Computing Platform" />
        <meta property="og:description" content="Democratizing AI computing through decentralized GPU networks" />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://neurogrid.network" />
        <meta property="og:site_name" content="NeuroGrid" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="NeuroGrid - Decentralized AI Computing Platform" />
        <meta property="twitter:description" content="Democratizing AI computing through decentralized GPU networks" />
        <meta property="twitter:image" content="/twitter-image.png" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "NeuroGrid",
              "description": "Democratizing AI computing through decentralized GPU networks",
              "url": "https://neurogrid.network",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Any",
              "browserRequirements": "Requires JavaScript. Requires HTML5.",
              "softwareVersion": "1.0.0",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "author": {
                "@type": "Organization",
                "name": "NeuroGrid Team"
              }
            })
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
        
        {/* No-Script fallback */}
        <noscript>
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: '#0f172a', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            padding: '2rem',
            zIndex: 9999
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>NeuroGrid</h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.8 }}>
              JavaScript is required to run this application.
            </p>
            <p style={{ opacity: 0.6 }}>
              Please enable JavaScript in your browser and reload the page.
            </p>
          </div>
        </noscript>
      </body>
    </Html>
  );
}