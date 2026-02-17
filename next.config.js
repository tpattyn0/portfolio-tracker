/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "yahoo-finance2"],
  eslint: {
    dirs: ["app", "components", "lib"],
  },
  typescript: {
    // Only type-check app code, not docs
  },
}

module.exports = nextConfig