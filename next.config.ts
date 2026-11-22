import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Seluruh pemrosesan CSV terjadi di browser, jadi app ini bisa diekspor statis
  // dan di-host gratis di Vercel/Netlify/Render tanpa backend.
  reactStrictMode: true,
};

export default nextConfig;
