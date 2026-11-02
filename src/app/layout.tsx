import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TiruppurKnit Ops · Export Production & TNA Delay Projection',
  description:
    'Production order-tracking, 2-week early delay warning engine, Tamil-to-English floor AI, and isolated buyer portals for Tiruppur knitwear exporters.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#FAFAFA] font-sans text-slate-900 antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}

