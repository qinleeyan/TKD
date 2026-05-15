"use client";

import { useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL, fetchWithAuth } from "@/lib/api";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("csv_file", file);
    formData.append("tournament_id", "1"); // Static for demo

    try {
      const res = await fetch(`${API_BASE_URL}/matchmaking/bulk-import-and-match/`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${localStorage.getItem("auth_token")}`
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        toast.success("Successfully imported and generated brackets!");
      } else {
        toast.error(data.error || "Failed to process CSV.");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-display tracking-tight mb-2">Bulk Initialization</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Import CSV & Auto-Matchmaking</p>
          </div>

          {!result ? (
            <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-3xl p-8">
              <form onSubmit={handleUpload} className="space-y-8">
                <div 
                  className="border-2 border-dashed border-foreground/10 rounded-2xl p-12 text-center hover:border-foreground/20 transition-all cursor-pointer bg-foreground/[0.02]"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Input 
                    id="file-upload" 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-foreground/5">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">{file ? file.name : "Select Tournament CSV"}</p>
                      <p className="text-sm text-muted-foreground mt-1">Format: Nama, Umur, Gender, TB, BB, Sabuk, Kontingen</p>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={!file || isUploading}
                  className="w-full bg-foreground text-background hover:bg-foreground/90 h-14 rounded-2xl text-lg font-medium"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing AI Matchmaking...
                    </>
                  ) : (
                    "Initialize Tournament"
                  )}
                </Button>
              </form>
            </Card>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <Card className="bg-green-500/5 border-green-500/20 rounded-3xl p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-3xl font-display mb-2">Success!</h2>
                <p className="text-muted-foreground">Imported {result.athletes_count} athletes and generated brackets.</p>
                <div className="mt-8 flex gap-4 justify-center">
                  <Button onClick={() => router.push("/matches")} className="bg-foreground text-background rounded-full px-8 h-12">View Brackets</Button>
                  <Button variant="outline" onClick={() => setResult(null)} className="rounded-full px-8 h-12">Upload Another</Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
