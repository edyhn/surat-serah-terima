import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "Surat Serah Terima", description: "Pengelolaan surat serah terima aset" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="id"><body><AppShell>{children}</AppShell></body></html>;
}
