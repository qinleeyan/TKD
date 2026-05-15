"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewAthletePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nama: "",
    umur: "",
    gender: "0",
    tinggi_cm: "",
    berat_kg: "",
    sabuk: "1",
    kontingen: "",
    tournament: "1" // Static for demo
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetchWithAuth("/athletes/", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Athlete registered successfully!");
        router.push("/dashboard/athletes");
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to register athlete.");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <Link href="/dashboard/athletes" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="font-mono text-xs uppercase tracking-widest">Back to Registry</span>
        </Link>

        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <h1 className="text-5xl font-display tracking-tight mb-2">New Athlete</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Register a single participant</p>
          </div>

          <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-3xl overflow-hidden">
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Name</label>
                    <Input 
                      placeholder="Enter athlete name"
                      value={formData.nama}
                      onChange={(e) => setFormData({...formData, nama: e.target.value})}
                      className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Age</label>
                      <Input 
                        type="number"
                        placeholder="Years"
                        value={formData.umur}
                        onChange={(e) => setFormData({...formData, umur: e.target.value})}
                        className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Gender</label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="bg-background/50 border-foreground/10 h-12 rounded-xl">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Male</SelectItem>
                          <SelectItem value="1">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Height (cm)</label>
                      <Input 
                        type="number"
                        placeholder="cm"
                        value={formData.tinggi_cm}
                        onChange={(e) => setFormData({...formData, tinggi_cm: e.target.value})}
                        className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Weight (kg)</label>
                      <Input 
                        type="number"
                        placeholder="kg"
                        value={formData.berat_kg}
                        onChange={(e) => setFormData({...formData, berat_kg: e.target.value})}
                        className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Belt/Sabuk Level (1-10)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 1 for White, 10 for Black"
                      value={formData.sabuk}
                      onChange={(e) => setFormData({...formData, sabuk: e.target.value})}
                      className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                      min="1" max="10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Team/Kontingen</label>
                    <Input 
                      placeholder="Club or City name"
                      value={formData.kontingen}
                      onChange={(e) => setFormData({...formData, kontingen: e.target.value})}
                      className="bg-background/50 border-foreground/10 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-8 bg-foreground/5 border-t border-foreground/5">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-foreground text-background hover:bg-foreground/90 h-14 rounded-2xl text-lg font-medium shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving Athlete Data...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Register Athlete
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
