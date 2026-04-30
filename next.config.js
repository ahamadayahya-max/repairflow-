/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer est un package ESM — il doit être transpilé par webpack
  transpilePackages: ['@react-pdf/renderer'],
}

module.exports = nextConfig
