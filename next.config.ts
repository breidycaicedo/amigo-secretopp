import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Las fotos se comprimen en el navegador (~300 KB); este es solo el techo.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Enlaces de la versión de un solo juego: se conservan para quienes ya los tienen.
  async redirects() {
    return [
      { source: "/registro", destination: "/juego/grupo-8/registro", permanent: false },
      { source: "/login", destination: "/juego/grupo-8/login", permanent: false },
      { source: "/admin/participantes", destination: "/admin/juegos/grupo-8/participantes", permanent: false },
      { source: "/admin/asignaciones", destination: "/admin/juegos/grupo-8/asignaciones", permanent: false },
    ];
  },
};

export default nextConfig;
