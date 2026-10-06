"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Eye,
    EyeOff,
    Loader2,
    ArrowLeft,
    Mail,
    Lock,
    User,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function LoginPage() {
    return (
        <React.Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
                    Loading…
                </div>
            }
        >
            <LoginFormContent />
        </React.Suspense>
    );
}

function LoginFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawNext = searchParams.get("next") ?? "/lessons";
    const nextTarget =
        rawNext.startsWith("/") && !rawNext.startsWith("//")
            ? rawNext
            : "/lessons";
    const callbackError = searchParams.get("error");

    const [mode, setMode] = React.useState<"signin" | "signup" | "forgot">(
        "signin",
    );
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [fullName, setFullName] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(
        callbackError === "auth_callback_failed"
            ? "Authentication link expired or invalid. Please sign in again."
            : null,
    );
    const [successMessage, setSuccessMessage] = React.useState<string | null>(
        null,
    );

    const supabase = React.useMemo(() => createBrowserSupabaseClient(), []);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const { data, error: authError } =
                await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            if (data.session) {
                router.push(nextTarget);
                router.refresh();
            }
        } catch (err: any) {
            setError(
                err?.message || "An unexpected error occurred during sign in.",
            );
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`,
                },
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            if (data.session) {
                // Auto-confirmed, session established
                router.push(nextTarget);
                router.refresh();
            } else {
                // Confirmation email sent
                setSuccessMessage(
                    "Account created. Please check your inbox for the confirmation email.",
                );
                setLoading(false);
            }
        } catch (err: any) {
            setError(
                err?.message || "An unexpected error occurred during sign up.",
            );
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const { error: resetError } =
                await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/auth/callback?next=/settings/account`,
                });

            if (resetError) {
                setError(resetError.message);
                setLoading(false);
                return;
            }

            setSuccessMessage(
                "Password reset email sent. Please check your inbox for the recovery link.",
            );
            setLoading(false);
        } catch (err: any) {
            setError(err?.message || "Could not send password reset email.");
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-between bg-background px-4 py-8 sm:px-6 lg:px-8">
            {/* Top Bar with theme toggle */}
            <div className="flex w-full items-center justify-between max-w-5xl mx-auto">
                <div className="flex items-center gap-2.5">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background border border-border/80 shadow-xs overflow-hidden shrink-0">
                        <Image
                            src="/logo-square.png"
                            alt="One Life"
                            width={32}
                            height={32}
                            className="size-6 object-contain"
                            priority
                        />
                    </div>
                    <span className="font-semibold text-[15px] tracking-tight">
                        One Life Admin
                    </span>
                </div>
                <ThemeToggle />
            </div>

            {/* Center Auth Card */}
            <div className="w-full max-w-[420px] mx-auto my-auto py-8">
                <Card className="border border-border shadow-sm">
                    <CardHeader className="space-y-1.5 pb-4">
                        <CardTitle className="text-xl font-semibold tracking-tight">
                            {mode === "forgot"
                                ? "Reset your password"
                                : "Sign in to One Life"}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            {mode === "forgot"
                                ? "Enter your email address to receive a secure recovery link."
                                : "Internal platform for lessons management and document conversion."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
                                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="flex items-start gap-2.5 p-3 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20">
                                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">
                                    {successMessage}
                                </span>
                            </div>
                        )}

                        {mode === "forgot" ? (
                            <form
                                onSubmit={handleForgotPassword}
                                className="space-y-4"
                            >
                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="forgot-email"
                                        className="text-xs font-medium"
                                    >
                                        Email address
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                        <Input
                                            id="forgot-email"
                                            name="email"
                                            type="email"
                                            autoComplete="username"
                                            enterKeyHint="done"
                                            placeholder="name@onelife.org"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setError(null);
                                            }}
                                            required
                                            className="pl-9 text-sm h-9"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-9 text-xs font-medium"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                                            Sending link…
                                        </>
                                    ) : (
                                        "Send reset link"
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                                    onClick={() => {
                                        setMode("signin");
                                        setError(null);
                                        setSuccessMessage(null);
                                    }}
                                >
                                    <ArrowLeft className="size-3.5" />
                                    Back to sign in
                                </Button>
                            </form>
                        ) : (
                            <Tabs
                                value={mode}
                                onValueChange={(val) => {
                                    setMode(val as "signin" | "signup");
                                    setError(null);
                                    setSuccessMessage(null);
                                }}
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2 mb-4 h-9">
                                    <TabsTrigger
                                        value="signin"
                                        className="text-xs"
                                    >
                                        Sign in
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="signup"
                                        className="text-xs"
                                    >
                                        Create account
                                    </TabsTrigger>
                                </TabsList>

                                {/* Sign In Tab */}
                                <TabsContent
                                    value="signin"
                                    className="space-y-4 mt-0"
                                >
                                    <form
                                        onSubmit={handleSignIn}
                                        className="space-y-3.5"
                                    >
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="signin-email"
                                                className="text-xs font-medium"
                                            >
                                                Email
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                <Input
                                                    id="signin-email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="username"
                                                    enterKeyHint="next"
                                                    placeholder="name@onelife.org"
                                                    value={email}
                                                    onChange={(e) => {
                                                        setEmail(
                                                            e.target.value,
                                                        );
                                                        setError(null);
                                                    }}
                                                    required
                                                    className="pl-9 text-sm h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label
                                                    htmlFor="signin-password"
                                                    className="text-xs font-medium"
                                                >
                                                    Password
                                                </Label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setMode("forgot");
                                                        setError(null);
                                                        setSuccessMessage(null);
                                                    }}
                                                    className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                <Input
                                                    id="signin-password"
                                                    name="password"
                                                    type={
                                                        showPassword
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    autoComplete="current-password"
                                                    enterKeyHint="done"
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) => {
                                                        setPassword(
                                                            e.target.value,
                                                        );
                                                        setError(null);
                                                    }}
                                                    required
                                                    className="pl-9 pr-9 text-sm h-9"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowPassword(
                                                            (prev) => !prev,
                                                        )
                                                    }
                                                    aria-label={
                                                        showPassword
                                                            ? "Hide password"
                                                            : "Show password"
                                                    }
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="size-4" />
                                                    ) : (
                                                        <Eye className="size-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-9 text-xs font-medium"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                                                    Signing in…
                                                </>
                                            ) : (
                                                "Sign in"
                                            )}
                                        </Button>
                                    </form>
                                </TabsContent>

                                {/* Sign Up Tab */}
                                <TabsContent
                                    value="signup"
                                    className="space-y-4 mt-0"
                                >
                                    <form
                                        onSubmit={handleSignUp}
                                        className="space-y-3.5"
                                    >
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="signup-name"
                                                className="text-xs font-medium"
                                            >
                                                Full name
                                            </Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                <Input
                                                    id="signup-name"
                                                    name="name"
                                                    type="text"
                                                    autoComplete="name"
                                                    enterKeyHint="next"
                                                    placeholder="Jane Doe"
                                                    value={fullName}
                                                    onChange={(e) =>
                                                        setFullName(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="pl-9 text-sm h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="signup-email"
                                                className="text-xs font-medium"
                                            >
                                                Email
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                <Input
                                                    id="signup-email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="username"
                                                    enterKeyHint="next"
                                                    placeholder="name@onelife.org"
                                                    value={email}
                                                    onChange={(e) => {
                                                        setEmail(
                                                            e.target.value,
                                                        );
                                                        setError(null);
                                                    }}
                                                    required
                                                    className="pl-9 text-sm h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="signup-password"
                                                className="text-xs font-medium"
                                            >
                                                Password
                                            </Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                <Input
                                                    id="signup-password"
                                                    name="password"
                                                    type={
                                                        showPassword
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    autoComplete="new-password"
                                                    enterKeyHint="done"
                                                    placeholder="At least 6 characters"
                                                    value={password}
                                                    onChange={(e) => {
                                                        setPassword(
                                                            e.target.value,
                                                        );
                                                        setError(null);
                                                    }}
                                                    required
                                                    minLength={6}
                                                    className="pl-9 pr-9 text-sm h-9"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowPassword(
                                                            (prev) => !prev,
                                                        )
                                                    }
                                                    aria-label={
                                                        showPassword
                                                            ? "Hide password"
                                                            : "Show password"
                                                    }
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="size-4" />
                                                    ) : (
                                                        <Eye className="size-4" />
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Minimum 6 characters.
                                            </p>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-9 text-xs font-medium"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                                                    Creating account…
                                                </>
                                            ) : (
                                                "Create account"
                                            )}
                                        </Button>
                                    </form>
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <div className="w-full text-center text-[12px] text-muted-foreground max-w-5xl mx-auto">
                <span>
                    One Life Admin · Deterministic format transfer & admin
                    console
                </span>
            </div>
        </div>
    );
}
