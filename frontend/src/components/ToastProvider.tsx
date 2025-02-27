"use client"
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/Toast"
import { useToast } from "@/lib/useToast"

const Toaster = () => {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, ...props }) => {
        return <Toast key={id} {...props} />
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toaster }
