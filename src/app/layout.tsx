import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = { title: "KUEST — Electric Bikes & Electric Scooters in Miami", description: "KUEST brings electric bikes and electric scooters to Miami and South Florida. Discover your next ride at our Biscayne Boulevard showroom.", icons: { icon: "/brand/favicon-source/favicon-kuest.png" }, openGraph: { title: "KUEST — Move different.", description: "Electric bikes and electric scooters for Miami / South Florida.", type: "website" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}><body>{children}</body></html>; }
