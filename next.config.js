/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required to disable body parsing for file upload API routes
  // handled per-route via config export
  output: "standalone",
};

module.exports = nextConfig;
