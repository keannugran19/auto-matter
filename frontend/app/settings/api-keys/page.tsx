"use client";

import * as React from "react";
import { KeyRound, Eye, EyeOff, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function ApiKeysPage() {
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [rememberKey, setRememberKey] = React.useState(true);

  React.useEffect(() => {
    const saved = localStorage.getItem("gemini_api_key");
    if (saved) setApiKey(saved);

    const savedRemember = localStorage.getItem("remember_gemini_api_key");
    if (savedRemember !== null) {
      setRememberKey(savedRemember !== "false");
    }
  }, []);

  const handleSave = () => {
    if (rememberKey) {
      if (apiKey.trim()) {
        localStorage.setItem("gemini_api_key", apiKey.trim());
      } else {
        localStorage.removeItem("gemini_api_key");
      }
      localStorage.setItem("remember_gemini_api_key", "true");
    } else {
      localStorage.removeItem("gemini_api_key");
      localStorage.setItem("remember_gemini_api_key", "false");
    }
    toast.success("API key settings saved");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          API Keys
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-0.5">
          Configure Gemini AI credentials for intelligent paragraph role classification.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Gemini API Key</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Used by the Gemini AI classifier in the Document Workstation.
              </CardDescription>
            </div>
            {apiKey ? (
              <Badge variant="ok" className="gap-1 font-medium text-[11px]">
                <CheckCircle2 className="size-3" />
                <span>Configured</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                Not set (uses heuristics)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-foreground block">Key string</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="pr-10 font-mono text-xs h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button onClick={handleSave} size="sm" className="h-9 gap-1.5 font-medium">
                <Save className="size-4" />
                <span>Save</span>
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Your key is stored locally in your browser and sent securely only during document processing.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <Switch
              checked={rememberKey}
              onCheckedChange={setRememberKey}
              id="remember-key"
            />
            <label
              htmlFor="remember-key"
              className="text-[13px] text-muted-foreground cursor-pointer select-none"
            >
              Remember key across browser sessions
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
