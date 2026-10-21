"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Link2, ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type ResetMode = "link" | "direct"

export function UserResetPasswordButton({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ResetMode>("link")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const resetState = () => {
    setMode("link")
    setPassword("")
    setConfirmPassword("")
  }

  const handleOpenChange = (next: boolean) => {
    if (loading) return
    setOpen(next)
    if (!next) resetState()
  }

  const handleSubmit = async () => {
    if (mode === "direct") {
      if (password.length < 8) {
        toast({
          title: "Error",
          description: "Password must be at least 8 characters",
          variant: "destructive",
        })
        return
      }
      if (password !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        })
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "direct" ? { mode, password } : { mode },
        ),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to reset password")
      }

      toast({
        title: "Success",
        description:
          mode === "link"
            ? `Reset link sent to ${userEmail}`
            : "Password updated successfully",
      })

      setOpen(false)
      resetState()
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" />
        Reset Password
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset the password for <span className="font-medium text-foreground">{userEmail}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("link")}
              disabled={loading}
              className={`rounded-lg border p-4 text-left transition-colors ${
                mode === "link"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Link2 className="mb-2 h-5 w-5 text-primary" />
              <div className="text-sm font-semibold">Send reset link</div>
              <div className="text-xs text-muted-foreground">
                Email a secure link. The user sets their own password.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("direct")}
              disabled={loading}
              className={`rounded-lg border p-4 text-left transition-colors ${
                mode === "direct"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
              <div className="text-sm font-semibold">Set new password</div>
              <div className="text-xs text-muted-foreground">
                Set a password now and notify the user by email.
              </div>
            </button>
          </div>

          {mode === "direct" && (
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "link" ? "Send Reset Link" : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
