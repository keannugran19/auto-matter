import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Auto-Matter — DOCX Format Transfer",
    description:
        "Reformat Word documents in-place using style transfer from a reference document.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased bg-slate-50 min-h-screen text-slate-900">
                {children}
            </body>
        </html>
    );
}
