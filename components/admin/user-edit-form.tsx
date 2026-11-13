"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function UserEditForm({ user }: { user: any }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const data = {
        name: formData.get("name"),
        email: formData.get("email"),
        role: formData.get("role"),
        bio: formData.get("bio"),
        points: formData.get("points") ? Number.parseInt(formData.get("points") as string) : undefined,
        level: formData.get("level") ? Number.parseInt(formData.get("level") as string) : undefined,
      }

      console.log("[v0] Submitting user update:", { userId: user.id, data })

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      console.log("[v0] API response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.log("[v0] API error:", errorData)
        throw new Error(errorData.error || "Failed to update user")
      }

      const result = await response.json()
      console.log("[v0] User updated successfully:", result)

      toast({
        title: "Success",
        description: "User updated successfully",
      })

      router.refresh()
    } catch (error) {
      console.log("[v0] Error in handleSubmit:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={user.name} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={user.email} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select name="role" defaultValue={user.role}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="instructor">Instructor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="event_staff">موظف فعاليات</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="points">Points</Label>
          <Input id="points" name="points" type="number" defaultValue={user.points} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <Input id="level" name="level" type="number" defaultValue={user.level} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={user.bio || ""} rows={3} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
