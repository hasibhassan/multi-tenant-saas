import { useAuth } from "@/components/AuthProvider"
import { ProgressBar } from "@/components/ProgressBar"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) return <ProgressBar />
  if (!user) return null // Prevent flash of protected content

  return <>{children}</>
}

export default AuthGuard
