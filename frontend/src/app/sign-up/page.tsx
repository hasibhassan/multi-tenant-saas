"use client"
import { useAuth } from "@/components/AuthProvider"
import OTPDialog from "@/components/OTPDialog"
import { SignUpForm } from "@/components/SignUpForm"
import { Progress } from "@radix-ui/react-progress"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DatabaseLogo } from "../../../public/DatabaseLogo"

export default function SignUpPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (!loading && user) {
      // If a user is already authenticated, redirect them away from login
      router.push("/dashboard")
    }
  }, [user, loading, router, isDialogOpen])

  // Optionally, show a loading spinner if still checking auth state
  if (loading) return <Progress />

  if (isDialogOpen) {
    return (
      <OTPDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        email={email}
        password={password}
      />
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <DatabaseLogo className="w-32 sm:w-40" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignUpForm
              setIsDialogOpen={setIsDialogOpen}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
            />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="https://ui.shadcn.com/placeholder.svg"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          width={100}
          height={100}
        />
      </div>
    </div>
  )
}
