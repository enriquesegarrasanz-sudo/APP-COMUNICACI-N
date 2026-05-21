import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APP SPEAKING",
  description: "Registro personal de evolucion hablando frente a camara.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

