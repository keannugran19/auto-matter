"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggleTheme = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);
        if (nextDark) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("one_life_theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("one_life_theme", "light");
        }
    };

    if (!mounted) {
        return (
            <div className="w-9 h-9 rounded-xl bg-muted border border-border" />
        );
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-xl border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? (
                <Sun className="w-4 h-4 text-warning" />
            ) : (
                <Moon className="w-4 h-4 text-primary" />
            )}
        </Button>
    );
}
