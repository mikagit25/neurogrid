/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    trailingSlash: true,
    images: {
        unoptimized: true
    },
    async rewrites() {
        // Use environment variable or default to localhost for development
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

        return [
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`
            }
        ]
    },
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
                    { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
                ]
            }
        ]
    }
}

module.exports = nextConfig