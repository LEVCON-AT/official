import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    '.space-z.ai',
  ],
  // CSP should be set via Nginx headers in production, not as meta tag,
  // because Next.js embeds inline scripts/styles that would be blocked.
  // Recommended Nginx header:
  // add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://levcon.ai; font-src 'self' https://levcon.ai; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
};

export default withNextIntl(nextConfig);
