import createMDX from "@next/mdx"
import dotenv from "dotenv"
import type { NextConfig } from "next"
import path from "path"

// Load .env file from two directories up
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_COGNITO_USER_POOL: process.env.NEXT_PUBLIC_COGNITO_USER_POOL,
    NEXT_PUBLIC_COGNITO_APP_CLIENT_ID:
      process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID,
    NEXT_PUBLIC_API_GATEWAY_ENDPOINT:
      process.env.NEXT_PUBLIC_API_GATEWAY_ENDPOINT,
    NEXT_PUBLIC_REGION: process.env.NEXT_PUBLIC_REGION,
    // Add other public env vars as needed
  },
}

const withMDX = createMDX({
  // Add markdown plugins here, as desired
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
