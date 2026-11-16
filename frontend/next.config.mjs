/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
