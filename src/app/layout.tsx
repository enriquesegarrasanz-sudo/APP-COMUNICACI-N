import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "SPEAKING",
  applicationName: "SPEAKING",
  description: "Registro personal de evolucion hablando frente a camara.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/brand/speaking-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/speaking-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/speaking-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "SPEAKING",
    description: "Registro personal de evolucion hablando frente a camara.",
    images: [
      {
        url: "/brand/speaking-og.png",
        width: 1200,
        height: 630,
        alt: "Logotipo de SPEAKING",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPEAKING",
    description: "Registro personal de evolucion hablando frente a camara.",
    images: ["/brand/speaking-og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
