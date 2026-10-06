"use client";

import * as React from "react";
import {
  User as UserIcon,
  Mail,
  Shield,
  Key,
  LogOut,
  Copy,
  Check,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AccountPage() {
  const { user, signOut, refreshUser } = useAuth();
  const supabase = React.useMemo(() => createBrowserSupabaseClient(), []);

  // Profile update state
  const [fullName, setFullName] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Password update state
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);

  // Copy UUID state
  const [copiedId, setCopiedId] = React.useState(false);

  React.useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    } else if (user?.email) {
      setFullName(user.email.split("@")[0]);
    }
  }, [user]);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be blank");
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (error) {
        toast.error(error.message);
      } else {
        await refreshUser();
        toast.success("Profile updated successfully");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password changed successfully");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string)
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "AD");

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          Account
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-0.5">
          Manage your personal profile, credentials, and active session.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">User Profile</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Personal identity and permissions in One Life Admin.
              </CardDescription>
            </div>
            <Badge variant="ok" className="gap-1 font-medium text-[11px]">
              <CheckCircle2 className="size-3" />
              <span>Active</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-secondary text-base font-bold text-secondary-foreground border border-border shrink-0">
              {initials}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {(user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Administrator"}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5" />
                <span>{user?.email || "admin@onelife.org"}</span>
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant="outline" className="text-[10.5px] px-2 py-0.5">
                  <Shield className="size-3 mr-1" />
                  Administrator
                </Badge>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-xs font-medium text-foreground">
                Display Name
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="display-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="h-9 text-xs"
                />
                <Button type="submit" size="sm" className="h-9 gap-1.5 font-medium shrink-0" disabled={savingProfile}>
                  {savingProfile ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  <span>Save</span>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Details Card */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-semibold">Account Details</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Technical credentials and audit identifiers.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 p-3 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[11px] block">User Identifier (UUID)</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] truncate text-foreground select-all">
                  {user?.id || "Local Session"}
                </span>
                {user?.id && (
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 p-1"
                    title="Copy User ID"
                  >
                    {copiedId ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1 p-3 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[11px] block">Authentication Provider</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Key className="size-3.5 text-muted-foreground" />
                <span>Email & Password</span>
              </span>
            </div>

            <div className="space-y-1 p-3 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[11px] block">Account Created</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{formatDate(user?.created_at)}</span>
              </span>
            </div>

            <div className="space-y-1 p-3 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground text-[11px] block">Last Sign In</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span>{formatDate(user?.last_sign_in_at)}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-semibold">Change Password</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Update your authentication password. Minimum 6 characters required.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2">
          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  className="pr-10 text-xs h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-foreground">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                className="text-xs h-9"
              />
            </div>

            <Button type="submit" size="sm" className="h-9 font-medium" disabled={savingPassword}>
              {savingPassword ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Updating password…
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Session & Logout Card */}
      <Card className="shadow-sm border border-destructive/20 bg-destructive/[0.02]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-semibold">Sign Out</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            End your current administrative session on this device.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            You will be redirected to the sign-in portal.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={signOut}
            className="gap-1.5 h-9 font-medium cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Sign out</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
