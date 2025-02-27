"use client"
import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { useState } from "react"
import { useAuth } from "./AuthProvider"

interface OTPDialogProps {
  email: string
  password: string
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export default function OTPDialog({
  email,
  password,
  isOpen,
  setIsOpen,
}: OTPDialogProps) {
  const [code, setCode] = useState("")
  const { confirm } = useAuth()

  async function handleSubmit(e: any) {
    e.preventDefault()
    console.log("calling handlesubmit in the confirmation code dialog")

    try {
      await confirm(email, code, password)
    } catch (error) {
      console.log("error encountered", { error })
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onClick={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Verify your email</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6">
                Enter the confirmation code sent your email.
              </DialogDescription>
              <div className="mt-4">
                <Label htmlFor="verify-account" className="font-medium">
                  Confirmation code
                </Label>
                <Input
                  id="verify-account"
                  name="verify-account"
                  className="mt-2"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button
                  className="mt-2 w-full sm:mt-0 sm:w-fit"
                  variant="secondary"
                >
                  Go back
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button type="submit" className="w-full sm:w-fit">
                  Verify
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
