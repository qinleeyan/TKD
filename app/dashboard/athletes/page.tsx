"use client";

import { useEffect, useState, useRef } from "react";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth, API_BASE_URL, WS_BASE_URL } from "@/lib/api";
import { Search, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const loadAthletes = async () => {
    const res = await fetchWithAuth("/athletes/");
    if (res.ok) {
      const data = await res.json();
      setAthletes(data.results || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAthletes();

    // Setup WebSocket for live updates
    // Assuming tournament ID 1 for demo
    const ws = new WebSocket(`${WS_BASE_URL}/tournament/1/`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "tournament_event" && data.event === "athlete_checkin") {
        toast.info(`Live Update: ${data.data.athlete_name} has checked in!`);
        loadAthletes(); // Refresh list
      }
    };
    socketRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const handleCheckIn = async (id: number) => {
    const res = await fetchWithAuth(`/athletes/${id}/checkin/`, {
      method: "POST",
      body: JSON.stringify({ status: "hadir" }),
    });

    if (res.ok) {
      toast.success("Athlete checked in successfully");
      loadAthletes();
    } else {
      toast.error("Failed to check in athlete");
    }
  };

  const filteredAthletes = athletes.filter(a => 
    a.nama.toLowerCase().includes(search.toLowerCase()) || 
    a.kontingen.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-display tracking-tight mb-2">Athletes Registry</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Manage participants & check-in</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or team..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-background/40 border-foreground/10 h-12 rounded-full"
            />
          </div>
        </div>

        <Card className="bg-background/40 backdrop-blur-xl border-foreground/10 shadow-2xl rounded-3xl overflow-hidden">
          <Table>
            <TableHeader className="bg-foreground/5">
              <TableRow className="border-foreground/5 hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase">Athlete Name</TableHead>
                <TableHead className="font-mono text-xs uppercase">Team/Kontingen</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Category</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Class</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Belt</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Weight/Height</TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredAthletes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center text-muted-foreground">
                    No athletes found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAthletes.map((athlete) => (
                  <TableRow key={athlete.id} className="border-foreground/5 hover:bg-foreground/5 transition-colors">
                    <TableCell className="font-medium py-6">{athlete.nama}</TableCell>
                    <TableCell className="text-muted-foreground">{athlete.kontingen}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="uppercase text-[10px] bg-blue-500/5 text-blue-500 border-blue-500/10">
                        {athlete.category || 'Kyourugi'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`uppercase text-[10px] ${
                        athlete.class_level === 'prestasi' ? 'bg-amber-500/5 text-amber-500 border-amber-500/10' : 'bg-purple-500/5 text-purple-500 border-purple-500/10'
                      }`}>
                        {athlete.class_level || 'Prestasi'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={athlete.is_checked_in ? "default" : "secondary"}
                        className={athlete.is_checked_in ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 border-0" : "bg-foreground/5 text-muted-foreground border-0"}
                      >
                        {athlete.is_checked_in ? "Checked In" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="uppercase text-[10px] border-foreground/20">
                          {athlete.sabuk_display || `Sabuk ${athlete.sabuk}`}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono">
                      {athlete.berat_kg}kg • {athlete.tinggi_cm}cm
                    </TableCell>
                    <TableCell className="text-right">
                      {!athlete.is_checked_in ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleCheckIn(athlete.id)}
                          className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-4"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Check In
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled className="text-green-500/50">
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </main>
  );
}
