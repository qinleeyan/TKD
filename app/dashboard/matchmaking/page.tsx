"use client";

import { useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { Sparkles, Loader2, Trophy, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function MatchmakingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleGenerateGroups = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/matchmaking/generate-groups/", {
        method: "POST",
        body: JSON.stringify({ tournament_id: 1 })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toast.success("AI Matchmaking successfully generated groups!");
      } else {
        toast.error("Failed to generate groups. Make sure athletes have checked in.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-12">
            <h1 className="text-5xl font-display tracking-tight mb-2">AI Matchmaking</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Autonomous Grouping Engine</p>
          </div>

          {!result ? (
            <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-3xl p-12">
              <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-foreground/20 blur-3xl rounded-full animate-pulse" />
                  <div className="relative p-8 rounded-full bg-foreground/5 border border-foreground/10">
                    <Sparkles className="w-16 h-16 text-foreground" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-2xl font-display">Ready to cluster athletes?</h2>
                  <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
                    The engine will use KMeans and KNN models to create balanced groups based on age, gender, height, weight, and belt level.
                  </p>
                </div>

                <div className="flex flex-col gap-4 w-full">
                  <Button 
                    onClick={handleGenerateGroups}
                    disabled={loading}
                    className="w-full bg-foreground text-background hover:bg-foreground/90 h-16 rounded-2xl text-lg font-medium shadow-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing Physical Data...
                      </>
                    ) : (
                      "Generate Balanced Groups"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground font-mono">
                    *Requires at least 2 checked-in athletes per category.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-3xl p-12 text-center animate-in zoom-in-95">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h2 className="text-3xl font-display mb-2">Matchmaking Complete</h2>
              <p className="text-muted-foreground mb-8">AI has successfully distributed athletes into balanced clusters.</p>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10">
                  <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-2xl font-display">{result.length}</p>
                  <p className="text-xs text-muted-foreground uppercase font-mono">Total Athletes</p>
                </div>
                <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10">
                  <Trophy className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-2xl font-display">{new Set(result.map((r: any) => r.cluster)).size}</p>
                  <p className="text-xs text-muted-foreground uppercase font-mono">Total Clusters</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => router.push("/matches")} className="flex-1 bg-foreground text-background rounded-full h-14">View Live Brackets</Button>
                <Button variant="outline" onClick={() => setResult(null)} className="flex-1 rounded-full h-14">Re-Run Engine</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
