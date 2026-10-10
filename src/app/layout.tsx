import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Appearance } from "@/components/app/Appearance";
import { AppProvider } from "@/components/app/AppProvider";
import { ServiceWorker } from "@/components/app/ServiceWorker";
import { MusicContextProvider } from "@/components/music/MusicContext";
import { SceneProvider } from "@/components/scenes/SceneContext";
import { VoiceProvider } from "@/components/voice/VoiceContext";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HomeCal",
  description: "Le calendrier familial tactile et intelligent",
  applicationName: "HomeCal",
  appleWebApp: { capable: true, title: "HomeCal", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4eee5" },
    { media: "(prefers-color-scheme: dark)", color: "#191a1c" },
  ],
};

// Apply the theme before first paint (avoids a light flash on the kiosk at night)
const themeScript = `(function(){try{var h=new Date().getHours();document.documentElement.dataset.period=h<6||h>=23?'night':h<11?'morning':h<18?'day':'evening';var t=localStorage.getItem('homecal.theme')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <AppProvider>
          <Appearance />
          <MusicContextProvider>
            <SceneProvider>
              <VoiceProvider>
                {children}
                <VoiceOverlay />
              </VoiceProvider>
            </SceneProvider>
          </MusicContextProvider>
        </AppProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
