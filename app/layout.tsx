import type {Metadata, Viewport} from 'next';
import './globals.css';
import { ThemeProvider } from './providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Symulator Zachowań AI',
  description: 'Eksploruj psychologiczne scenariusze i analizuj swoje reakcje.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/Psycholog-AI/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="application-name" content="Symulator AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Symulator AI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" type="image/png" sizes="192x192" href="/Psycholog-AI/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/Psycholog-AI/icon-512.png" />
        <link rel="apple-touch-icon" href="/Psycholog-AI/icon-192.png" />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
