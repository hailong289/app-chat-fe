import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disabled for React 19 / Next 15 BlockNote compatibility
  // Removed 'output: standalone' - using standard build for Docker

  // Transpile BlockNote packages for compatibility
  transpilePackages: [
    "@blocknote/core",
    "@blocknote/react",
    "@blocknote/mantine",
  ],

  webpack: (config, { isServer }) => {
    // Fix for BlockNote with webpack/turbopack
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Force a single Yjs instance across all chunks. Without this, the
    // dynamic-imported BlockNoteEditor chunk resolves its own copy of yjs
    // (BlockNote bundles it as a dependency) while the main page chunk
    // resolves another copy via direct `import { Doc } from "yjs"`. Two
    // modules → two `Y.Doc` constructors → `instanceof` checks fail and
    // Yjs prints the well-known warning (see yjs/yjs#438). Aliasing to an
    // absolute path collapses both back to one module instance.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      yjs: path.resolve(__dirname, "node_modules/yjs"),
      "y-protocols": path.resolve(__dirname, "node_modules/y-protocols"),
      // Same dedup story as yjs: linkifyjs maintains internal "is initialized"
      // state, so two bundled copies cause "already initialized — won't register
      // custom scheme" warning when @tiptap/extension-link tries to add http/
      // https schemes from a chunk that loaded its own linkifyjs.
      linkifyjs: path.resolve(__dirname, "node_modules/linkifyjs"),
    };

    return config;
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    NEXT_PUBLIC_REACT_APP_TENOR_API_KEY:
      process.env.NEXT_PUBLIC_REACT_APP_TENOR_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3.us-east-005.backblazeb2.com",
        port: "",
        pathname: "/**",
      },
    ],
    // Alternative: use dangerouslyAllowSVG and contentSecurityPolicy for placeholder services
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
