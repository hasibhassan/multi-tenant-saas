"use client"
import AmplifyProvider from "@/components/AmplifyProvider"
import { AuthProvider } from "@/components/AuthProvider"
import Footer from "@/components/ui/Footer"
import { Navigation } from "@/components/ui/Navbar"
import { ThemeProvider } from "next-themes"
import { Inter } from "next/font/google"
import { usePathname } from "next/navigation"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const isLanding =
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/sign-up")

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen scroll-auto antialiased selection:bg-indigo-100 selection:text-indigo-700 dark:bg-gray-950`}
      >
        <AmplifyProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
            >
              {isLanding && <Navigation />}
              {children}
              {isLanding && <Footer />}
            </ThemeProvider>
          </AuthProvider>
        </AmplifyProvider>
      </body>
    </html>
  )
}
