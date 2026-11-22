import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BIOTA — Dashboard Penjualan Marketplace',
  description:
    'Mengubah ekspor pesanan Shopee, TikTok Shop dan Tokopedia menjadi net revenue per channel dan per produk.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
