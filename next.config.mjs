/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // HMR is disabled in AI Studio via DISABLE_HMR env var.
  // We don't need to explicitly set it here as the platform handles it.
};

export default nextConfig;
