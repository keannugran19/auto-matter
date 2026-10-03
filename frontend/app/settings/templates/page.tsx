"use client";

import * as React from "react";
import {
    FileType2,
    UploadCloud,
    CheckCircle2,
    ShieldCheck,
    Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ReferenceTemplatesPage() {
    const [defaultTemplate, setDefaultTemplate] = React.useState(
        "onelife-reference-v3.docx",
    );
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        const saved = localStorage.getItem("onelife_default_reference_name");
        if (saved) setDefaultTemplate(saved);
    }, []);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const f = e.target.files[0];
            setDefaultTemplate(f.name);
            localStorage.setItem("onelife_default_reference_name", f.name);
            toast.success(`Set ${f.name} as active default template`);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                    Reference Templates
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-0.5">
                    Master styles, geometry definitions, and paragraph role
                    typography for format transfer.
                </p>
            </div>

            <Card className="shadow-sm border border-border">
                <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Active Default Template
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                Automatically preselected as reference in the
                                Document Workstation.
                            </CardDescription>
                        </div>
                        <Badge variant="ok" className="gap-1 font-medium">
                            <CheckCircle2 className="size-3" />
                            <span>Active Default</span>
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-5 pt-2 space-y-4">
                    <div className="flex items-center gap-3.5 p-4 rounded-lg border border-border bg-muted/20">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shrink-0">
                            <FileType2 className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <b className="block text-[14px] font-medium text-foreground">
                                {defaultTemplate}
                            </b>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                15.9 KB · Letter (8.5 × 11 in) · 0.5 in margins
                                · 10 core typography roles
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    toast.success(
                                        `Downloading ${defaultTemplate}`,
                                    )
                                }
                                className="h-8 text-xs gap-1.5"
                            >
                                <Download className="size-3.5" />
                                <span>Download</span>
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                accept=".docx"
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-8 text-xs"
                            >
                                Change template
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                        <div className="p-3 rounded-md border border-border bg-card">
                            <span className="text-muted-foreground block mb-1">
                                Typography hierarchy
                            </span>
                            <span className="font-semibold text-foreground">
                                Times New Roman 22 pt base
                            </span>
                        </div>
                        <div className="p-3 rounded-md border border-border bg-card">
                            <span className="text-muted-foreground block mb-1">
                                Layout geometry
                            </span>
                            <span className="font-semibold text-foreground">
                                Letter · 36 pt (0.5 in) margins
                            </span>
                        </div>
                        <div className="p-3 rounded-md border border-border bg-card">
                            <span className="text-muted-foreground block mb-1">
                                Header & footer
                            </span>
                            <span className="font-semibold text-foreground">
                                Series subtitle sync
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
