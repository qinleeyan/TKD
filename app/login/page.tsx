"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api";
import { Navigation } from "@/components/landing/navigation";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "register") router.replace("/registrasi");
      else if (user.role === "operator") router.replace("/operator");
      else if (user.role === "match") router.replace("/matches");
      else if (user.role === "superadmin") router.replace("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user?.role || "", data.user?.username || "");
        toast.success("Login successful! Welcome back.");
      } else {
        toast.error(data.error || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background noise-overlay flex flex-col">
      <Navigation />
      
      <div className="flex-1 flex items-center justify-center p-6 mt-16">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-display tracking-tight">Access Control</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Tournament Management System</p>
          </div>

          <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-display">Sign in</CardTitle>
              <CardDescription>Enter your credentials to manage the tournament</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    type="text" 
                    placeholder="Username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-background/50 border-foreground/10 h-12 rounded-xl focus-visible:ring-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 border-foreground/10 h-12 rounded-xl focus-visible:ring-foreground"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-foreground text-background hover:bg-foreground/90 h-12 rounded-xl text-base font-medium transition-all"
                >
                  {isLoading ? "Authenticating..." : "Login to Dashboard"}
                </Button>
              </CardFooter>
            </form>
          </Card>
          
          <p className="text-center text-xs text-muted-foreground font-mono">
            SECURE ACCESS PORTAL • VERSION 2.0.4
          </p>
        </div>
      </div>
    </main>
  );
}
