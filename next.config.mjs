/** @type {import('next').NextConfig} */
const nextConfig = {
  // kuromoji は実行時に辞書ファイルを fs で読むため、Serverless 出力へ明示的に同梱する。
  experimental: {
    outputFileTracingIncludes: {
      "/*": ["./node_modules/kuromoji/dict/**/*"],
    },
  },
};

export default nextConfig;
