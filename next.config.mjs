/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2048mb',
    },
  },
  // PGlite resolves its wasm/data assets via import.meta.url; bundling it
  // rewrites that path and breaks the local dev DB fallback in lib/db/index.ts.
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingIncludes: {
    '/api/tickets/*/wallet': ['./public/icons/icon-512.png'],
  },
}

export default nextConfig
