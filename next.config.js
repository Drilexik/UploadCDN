/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required to disable body parsing for file upload API routes
  // handled per-route via config export
  output: "standalone",
  
  // Security headers and configuration
  poweredByHeader: false,
  
  // Compress responses
  compress: true,
  
  // Security
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "off",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "geolocation=(), microphone=(), camera=()",
        },
      ],
    },
  ],
  
  // Redirects HTTP to HTTPS in production (requires load balancer configuration)
  redirects: async () => [
    {
      source: "/:path*",
      destination: "/:path*",
      permanent: false,
    },
  ],
};

module.exports = nextConfig;
