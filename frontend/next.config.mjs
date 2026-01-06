/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019b93b6-85c8-acf9-3591-e4efa35c77fe',
        permanent: false, // This ensures a temporary 307 redirect
        statusCode: 307,  // Explicitly set to 307 (recommended by Farcaster)
      },
    ];
  },
};

export default nextConfig;