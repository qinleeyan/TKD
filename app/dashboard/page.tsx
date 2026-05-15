"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { Users, Trophy, Activity, Plus, Upload, Play, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    athletes: 0,
    matches: 0,
    tournaments: 0,
    checkedIn: 0
  });
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== "superadmin") {
        // Redirect to login if not logged in, or to their respective page if they have a role
        if (!user) {
          router.push("/login");
        } else {
          router.push(`/${user.role === 'register' ? 'registrasi' : user.role}`);
        }
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authChecked) return;
    async function loadStats() {
      const athletesRes = await fetchWithAuth("/athletes/");
      const matchesRes = await fetchWithAuth("/matches/");
      const tourRes = await fetchWithAuth("/athletes/tournaments/");
      
      if (athletesRes.ok && matchesRes.ok && tourRes.ok) {
        const athletes = await athletesRes.json();
        const matchesData = await matchesRes.json();
        const tours = await tourRes.json();
        
        setStats({
          athletes: athletes.count || 0,
          matches: matchesData.count || 0,
          tournaments: tours.count || 0,
          checkedIn: athletes.results?.filter((a: any) => a.is_checked_in).length || 0
        });
        setRecentMatches(matchesData.results || []);
      }
    }
    loadStats();
  }, []);

  const quickActions = [
    { title: "Register Athlete", icon: Plus, href: "/dashboard/athletes/new", color: "text-blue-500" },
    { title: "Bulk Import CSV", icon: Upload, href: "/dashboard/import", color: "text-purple-500" },
    { title: "Generate Brackets", icon: Play, href: "/dashboard/matchmaking", color: "text-green-500" },
  ];

  if (authLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-display tracking-tight mb-2">Tournament Control</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Real-time Management Overview</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="rounded-full px-6">Export Reports</Button>
            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6">Start Arena 1</Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Athletes" value={stats.athletes} icon={Users} description="Registered participants" />
          <StatCard title="Checked-In" value={stats.checkedIn} icon={Activity} description="Athletes at venue" color="text-green-500" />
          <StatCard title="Total Matches" value={stats.matches} icon={Trophy} description="Scheduled bouts" />
          <StatCard title="Active Events" value={stats.tournaments} icon={Activity} description="Ongoing tournaments" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <Card className="lg:col-span-1 bg-background/40 backdrop-blur-xl border-foreground/10 shadow-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display">Quick Actions</CardTitle>
              <CardDescription>Common tournament operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-foreground/5 hover:bg-foreground/5 transition-all cursor-pointer group">
                    <div className={`p-3 rounded-lg bg-foreground/5 group-hover:bg-foreground/10 transition-colors`}>
                      <action.icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <span className="font-medium">{action.title}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity placeholder */}
          <Card className="lg:col-span-2 bg-background/40 backdrop-blur-xl border-foreground/10 shadow-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display">Live Tournament Feed</CardTitle>
              <CardDescription>Latest updates from the arena</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentMatches.length > 0 ? (
                  recentMatches.slice(0, 5).map((match) => (
                    <div key={match.id} className="flex gap-4 items-start pb-6 border-b border-foreground/5 last:border-0 last:pb-0">
                      <div className={`w-2 h-2 rounded-full mt-2 ${match.status === 'finished' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="text-sm font-medium">Match #{match.match_number} {match.status === 'finished' ? 'Finished' : 'In Progress'} in {match.arena_name || 'Arena'}</p>
                        {match.winner_name && (
                          <p className="text-xs text-muted-foreground mt-1">Winner: {match.winner_name} ({match.winner_corner?.toUpperCase()} Corner)</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-mono uppercase tracking-widest">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon: Icon, description, color = "text-foreground" }: any) {
  return (
    <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-xl rounded-2xl hover:border-foreground/20 transition-all">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 rounded-xl bg-foreground/5">
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-4xl font-display tracking-tight">{value}</p>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
