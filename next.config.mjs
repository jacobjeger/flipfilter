/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // WebUSB/WebADB modules need browser APIs
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    // Handle .wasm files for potential ADB usage
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  // Allow importing from node_modules for @yume-chan packages
  transpilePackages: [
    '@yume-chan/adb',
    '@yume-chan/adb-daemon-webusb',
    '@yume-chan/stream-extra',
    '@yume-chan/struct',
    '@yume-chan/event',
  ],
};

export default nextConfig;
