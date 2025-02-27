"use client"
import { useToast } from "@/lib/useToast"
import {
  confirmSignUp,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth"
import { useRouter } from "next/navigation"
import React, { createContext, useContext, useEffect, useState } from "react"

export type AuthUser = { username: string } | null

// Create the AuthContext
const AuthContext = createContext<{
  user: AuthUser
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  createAccount: (email: string, password: string) => Promise<void>
  confirm: (
    email: string,
    confirmationCode: string,
    password: string,
  ) => Promise<void>
  logout: () => Promise<void>
}>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  createAccount: async () => {},
  confirm: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  // Check for an authenticated user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser()
        setUser(userData)
      } catch (error: unknown) {
        // if the error indicates there’s no authenticated user, we set user to null
        console.log({ error })

        if (
          error instanceof Error &&
          error?.message &&
          error.message.includes(
            "User needs to be authenticated to call this API.",
          )
        ) {
          setUser(null)
        } else {
          console.error("Unexpected error checking current user", error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const { nextStep } = await signIn({
        username: email,
        password,
      })

      if (nextStep?.signInStep === "DONE") {
        const userData = await getCurrentUser()
        setUser(userData)
        router.push("/dashboard")
      } else {
        console.log("Next step required:", nextStep)
        toast({
          title: "Info",
          description: `${nextStep.signInStep}`,
          variant: "info",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error("Login failed:", error)
      toast({
        title: "Error",
        description: `${error}`,
        variant: "error",
        duration: 3000,
      })
    }
  }

  // Create Account function
  const createAccount = async (email: string, password: string) => {
    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      })

      console.log({ isSignUpComplete })

      if (nextStep?.signUpStep === "DONE") {
        const userData = await getCurrentUser()
        setUser(userData)
        router.push("/dashboard")
      } else if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        console.log(
          `Code Delivery Medium: ${nextStep.codeDeliveryDetails.deliveryMedium}`,
        )
        console.log(
          `Code Delivery Destination: ${nextStep.codeDeliveryDetails.destination}`,
        )
      } else {
        console.log("Next step required:", nextStep)
      }
    } catch (error) {
      console.error("Login failed:", error)
      toast({
        title: "Error",
        description: `${error}`,
        variant: "error",
        duration: 10000,
      })
    }
  }

  // Logout function
  const logout = async () => {
    await signOut()
    setUser(null)
    router.push("/login")
  }

  const confirm = async (
    email: string,
    confirmationCode: string,
    password: string,
  ) => {
    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode,
      })

      if (isSignUpComplete) {
        toast({
          title: "Account creation success",
          description: `Successfully verifed and created account`,
          variant: "success",
          duration: 3000,
        })

        // Auto-login after confirmation
        const user = await signIn({ username: email, password })

        console.log("sign up complete, navigating to dashboard", { user })
        if (user?.nextStep?.signInStep === "DONE") {
          const userData = await getCurrentUser()
          setUser(userData)
          router.push("/dashboard")
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `${error}`,
        variant: "error",
        duration: 3000,
      })
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, createAccount, confirm, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext)
