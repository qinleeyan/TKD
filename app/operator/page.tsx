"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchWithAuth } from "@/lib/api";
import { 
  Layout, 
  Loader2, 
  RefreshCw, 
  Swords, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ArrowLeft,
  Activity,
  User,
  Megaphone
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

type Participant = {
  athlete: number;
  corner: "red" | "blue";
  athlete_detail?: {
    id?: number;
    nama: string;
    kontingen?: string;
    is_checked_in?: boolean;
    berat_kg?: number;
    tinggi_cm?: number;
    umur?: number;
    class_level?: string;
    sabuk_display?: string;
    gender_display?: string;
  };
};

type MatchRow = {
  id: number;
  bout_number?: number;
  match_number: number;
  status: "scheduled" | "called" | "ongoing" | "finished";
  group_name?: string;
  participants: Participant[];
};

const TOURNAMENT_ID = 1;

export default function OperatorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  type Arena = {
    id: number;
    name: string;
    status: string;
    tournament: number;
    category?: string; // Optional metadata for operator UI
    level?: string;
  };

  const [courtConfig, setCourtConfig] = useState<Arena | null>(null);
  const [tempConfig, setTempConfig] = useState<{
    category: string;
    level: string;
    name: string;
  }>({
    category: "kyourugi",
    level: "prestasi",
    name: ""
  });
  const [savedCourts, setSavedCourts] = useState<Arena[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  
  const selectedMatch = useMemo(() => 
    matches.find(m => m.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const filteredMatches = useMemo(() => 
    matches.filter(m => 
      m.status !== 'finished' && 
      m.participants.every(p => p.athlete_detail?.is_checked_in)
    ),
    [matches]
  );

  const loadCourts = useCallback(async () => {
    setLoadingCourts(true);
    try {
      const res = await fetchWithAuth(`/arenas/?tournament=${TOURNAMENT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setSavedCourts(data.results || []);
      }
    } catch (e) {
      console.error("Failed to load arenas", e);
    }
    setLoadingCourts(false);
  }, []);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  const saveCourt = async (config: { category: string; level: string; name: string }) => {
    try {
      const res = await fetchWithAuth(`/arenas/`, {
        method: "POST",
        body: JSON.stringify({
          name: config.name,
          tournament: TOURNAMENT_ID,
          status: 'idle'
        })
      });
      if (res.ok) {
        const newArena = await res.json();
        setSavedCourts(prev => [...prev, newArena]);
        setCourtConfig(newArena);
        toast.success("Lapangan berhasil ditambahkan.");
      } else {
        toast.error("Gagal menambahkan lapangan.");
      }
    } catch (e) {
      toast.error("Error saat menyimpan lapangan.");
    }
  };

  const deleteCourt = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/arenas/${id}/`, { method: "DELETE" });
      if (res.ok) {
        setSavedCourts(prev => prev.filter(c => c.id !== id));
        if (courtConfig?.id === id) setCourtConfig(null);
        toast.success("Lapangan dihapus.");
      } else {
        toast.error("Gagal menghapus lapangan.");
      }
    } catch (e) {
      toast.error("Error saat menghapus lapangan.");
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user || (user.role !== "operator" && user.role !== "superadmin")) {
        router.push("/dashboard");
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, loading, router]);

  const lastEventRef = useRef<{ id: string; time: number } | null>(null);

  const loadMatches = useCallback(async () => {
    if (!courtConfig) return;
    setLoadingMatches(true);
    try {
      const res = await fetchWithAuth(`/matches/?tournament=${TOURNAMENT_ID}&arena=${courtConfig.id}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.results || []);
      }
    } catch (e) {
      console.error("Failed to load matches", e);
    }
    setLoadingMatches(false);
  }, [courtConfig]);

  useEffect(() => {
    if (user && courtConfig) loadMatches();
  }, [courtConfig, user, loadMatches]);

  useRealtime(TOURNAMENT_ID, useCallback((ev, data) => {
    // 🛡️ DEDUPLICATION GUARD
    const eventId = `${ev}-${data?.id || data?.athlete_id || 'global'}`;
    const now = Date.now();
    if (lastEventRef.current?.id === eventId && now - lastEventRef.current.time < 2000) {
      return; // Skip if same event in < 2s
    }
    lastEventRef.current = { id: eventId, time: now };

    if (["match_updated", "match_created", "match_called", "match_started", "match_finished"].includes(ev) && data?.id) {
      setMatches(prev => {
        const exists = prev.find(m => m.id === data.id);
        if (exists) {
          return prev.map(m => m.id === data.id ? data : m);
        }
        if (ev === "match_created") {
          return [...prev, data];
        }
        return prev;
      });
    }

    if (ev === "match_deleted" && data?.id) {
      setMatches(prev => prev.filter(m => m.id !== data.id));
    }

    if (ev === "athlete_checkin") {
      const athleteId = parseInt(data.id || data.athlete_id);
      const isHadir = data.is_checked_in;

      if (isHadir && !data?.final_sync) {
        toast.success(`${data.nama || 'Atlet'} (${data.kontingen || 'Umum'}) sudah hadir!`, {
          id: `athlete-checkin-${athleteId}`,
          description: "Atlet siap untuk dipanggil.",
        });
      }

      // ⚡ LOCAL UPDATE
      setMatches(prev => prev.map(m => ({
        ...m,
        participants: m.participants.map(p => 
          p.athlete === athleteId || p.athlete_detail?.id === athleteId
          ? { ...p, athlete_detail: p.athlete_detail ? { ...p.athlete_detail, is_checked_in: isHadir } : p.athlete_detail }
          : p
        )
      })));
    }

    if (ev === "groups_confirmed") {
      loadMatches();
    }

    if (ev === "athlete_created") {
      toast.info(`📢 ${data.nama} (${data.kontingen || 'UMUM'}) baru saja mendaftar!`, {
        id: `created-${data.id}`,
      });
    }

    if (ev === "match_finished" && data?.id) {
      toast.success(`🏆 ${data.winner_name} memenangkan partai #${data.bout_number || data.match_number}!`, {
        id: `match-${data.id}`,
      });
    }
  }, [courtConfig, loadMatches]));

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const postAction = async (matchId: number, action: "call" | "start") => {
    const res = await fetchWithAuth(`/matches/${matchId}/${action}/`, { method: "POST" });
    if (res.ok) {
      toast.success(action === "call" ? "Partai dipanggil." : "Pertandingan dimulai.");
    } else {
      toast.error("Gagal menjalankan aksi.");
    }
  };

  const finishMatch = async (matchId: number, participant: Participant) => {
    const res = await fetchWithAuth(`/matches/${matchId}/finish/`, {
      method: "POST",
      body: JSON.stringify({ winner_id: participant.athlete, winner_corner: participant.corner }),
    });
    if (res.ok) {
      toast.success("Pertandingan selesai.");
      setSelectedMatchId(null);
    } else {
      toast.error("Gagal menyelesaikan pertandingan.");
    }
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden selection:bg-foreground selection:text-background font-sans">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle Noise */}
        <div className="absolute inset-0 opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
        
        {/* Subtle Grid Lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div key={`v-${i}`} className="absolute w-px h-full bg-foreground" style={{ left: `${(i + 1) * 8.33}%` }} />
          ))}
          {[...Array(8)].map((_, i) => (
            <div key={`h-${i}`} className="absolute h-px w-full bg-foreground" style={{ top: `${(i + 1) * 12.5}%` }} />
          ))}
        </div>

        {/* Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>
      <Navigation />

      <div className="relative z-10 mx-auto max-w-[1600px] px-8 pt-28 h-screen flex flex-col overflow-hidden">
        {!courtConfig ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full pb-20">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-display tracking-tight mb-4 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent italic">Operator Dashboard</h1>
              <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-xs">Pilih lapangan untuk mulai mengelola pertandingan</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
              <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer border-dashed border-foreground/10 hover:border-foreground/20 transition-all duration-500 flex flex-col items-center justify-center p-12 bg-foreground/[0.01] hover:bg-foreground/[0.03] rounded-[3rem] backdrop-blur-sm">
                    <div className="h-20 w-20 rounded-full bg-background flex items-center justify-center shadow-2xl mb-8 group-hover:scale-110 transition-all duration-500 border border-foreground/5 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Plus className="h-10 w-10 relative z-10" />
                    </div>
                    <p className="font-display text-xl tracking-tight italic opacity-60 group-hover:opacity-100 transition-opacity">Tambah Lapangan</p>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none bg-background/95 backdrop-blur-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-display italic">Konfigurasi Lapangan</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Kategori</Label>
                        <Select onValueChange={(val) => setTempConfig(prev => ({ ...prev, category: val }))} defaultValue="kyourugi">
                          <SelectTrigger className="h-12 rounded-2xl bg-secondary/30 border-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none">
                            <SelectItem value="kyourugi">Kyourugi</SelectItem>
                            <SelectItem value="poomsae">Poomsae</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Kelas</Label>
                        <Select onValueChange={(val) => setTempConfig(prev => ({ ...prev, level: val }))} defaultValue="prestasi">
                          <SelectTrigger className="h-12 rounded-2xl bg-secondary/30 border-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none">
                            <SelectItem value="prestasi">Prestasi</SelectItem>
                            <SelectItem value="pemula">Pemula</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Nama Lapangan</Label>
                      <Input 
                        placeholder="Misal: LAPANGAN A" 
                        className="h-12 rounded-2xl bg-secondary/30 border-none font-display text-lg"
                        value={tempConfig.name}
                        onChange={(e) => setTempConfig(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <Button 
                      className="w-full h-14 text-lg font-bold rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-xl shadow-black/10"
                      onClick={() => {
                        if (tempConfig.name) {
                          saveCourt(tempConfig);
                          setShowForm(false);
                        }
                      }}
                    >
                      Aktifkan Lapangan
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {savedCourts.map((court, i) => (
                <Card 
                  key={i}
                  className="relative group p-10 cursor-pointer transition-all duration-700 border border-foreground/[0.03] bg-foreground/[0.02] hover:bg-foreground/[0.04] backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl shadow-black/[0.02] hover:shadow-black/[0.05] hover:-translate-y-2"
                  onClick={() => setCourtConfig(court)}
                >
                  <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-12 w-12 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourt(court.id);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-10">
                    <Badge variant="outline" className="px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase border-foreground/10 bg-background/50 backdrop-blur-md">ARENA</Badge>
                    <Badge variant="secondary" className="px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase bg-foreground text-background">{court.status}</Badge>
                  </div>

                  <h3 className="text-4xl font-display italic tracking-tight mb-4 leading-none group-hover:translate-x-1 transition-transform duration-500">{court.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-40 group-hover:opacity-60 transition-opacity">Panel Kendali Operator</p>
                  
                  <div className="mt-12 pt-8 border-t border-foreground/[0.05] flex items-center justify-between text-muted-foreground group-hover:text-foreground transition-all duration-500">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Initialize System</span>
                    <div className="h-10 w-10 rounded-full bg-foreground/0 group-hover:bg-foreground/5 flex items-center justify-center transition-all duration-500 group-hover:translate-x-2">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-8 overflow-hidden pb-8">
            {/* Left Panel: Match Control (45%) */}
            <div className="w-[45%] flex flex-col gap-6">
              <div className="flex items-center justify-between p-6 bg-card/40 backdrop-blur-3xl rounded-[2rem] border border-foreground/[0.08] shadow-2xl">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCourtConfig(null)}
                  className="gap-2 rounded-xl border-foreground/10 hover:bg-foreground/5 px-4 h-10 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                </Button>
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5 opacity-60">{courtConfig.status}</p>
                  <h2 className="text-2xl font-display italic tracking-tight uppercase leading-none">{courtConfig.name}</h2>
                </div>
              </div>

              {selectedMatch ? (
                <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    <AthleteControlCard 
                      participant={selectedMatch.participants.find(p => p.corner === "red")} 
                      corner="red" 
                      onWin={() => finishMatch(selectedMatch.id, selectedMatch.participants.find(p => p.corner === "red")!)}
                    />
                    <AthleteControlCard 
                      participant={selectedMatch.participants.find(p => p.corner === "blue")} 
                      corner="blue" 
                      onWin={() => finishMatch(selectedMatch.id, selectedMatch.participants.find(p => p.corner === "blue")!)}
                    />
                  </div>

                  <Card className="bg-card/40 border border-foreground/[0.08] shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-3xl">
                    <CardHeader className="p-8 pb-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl font-display italic tracking-tight uppercase">Detail Pertandingan</CardTitle>
                        </div>
                        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-foreground text-background shadow-xl">
                          <span className="text-xl font-black font-display tracking-tighter">#{selectedMatch.bout_number || selectedMatch.match_number}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-2 space-y-8">
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/[0.05]">
                        <div>
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1 opacity-60">KELAS</p>
                          <p className="font-display text-sm tracking-tight italic uppercase">{selectedMatch.group_name || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1 opacity-60">STATUS</p>
                          <p className="font-display text-sm tracking-tight italic uppercase">{selectedMatch.status}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {selectedMatch.status === 'scheduled' && (
                          <Button 
                            className="flex-1 h-14 text-[10px] font-black italic tracking-[0.2em] gap-2 rounded-xl bg-background border border-foreground/10 hover:bg-foreground hover:text-background transition-all shadow-xl active:scale-[0.98]"
                            onClick={() => postAction(selectedMatch.id, 'call')}
                          >
                            <Megaphone className="h-3.5 w-3.5" /> PANGGIL ATLET
                          </Button>
                        )}
                        {(selectedMatch.status === 'called' || selectedMatch.status === 'scheduled') && (
                          <Button 
                            className="flex-1 h-14 text-[10px] font-black italic tracking-[0.2em] gap-2 rounded-xl bg-foreground text-background hover:opacity-90 transition-all shadow-2xl active:scale-[0.98]"
                            onClick={() => postAction(selectedMatch.id, 'start')}
                          >
                            <Swords className="h-3.5 w-3.5" /> MULAI TANDING
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                 <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-foreground/5 rounded-[3.5rem] bg-foreground/[0.01] transition-all duration-700 hover:bg-foreground/[0.02] group/empty">
                  <div className="relative mb-10 transition-transform duration-700 group-hover/empty:scale-110">
                    <Activity className="h-24 w-24 text-foreground opacity-[0.03]" />
                    <div className="absolute inset-0 h-24 w-24 border border-foreground opacity-[0.05] rounded-full animate-ping" />
                  </div>
                  <h3 className="font-display text-3xl italic tracking-tight opacity-30">Pilih partai untuk dikelola</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30 mt-4">Antrean Sistem Sinkron</p>
                </div>
              )}
            </div>

            {/* Right Panel: Match Queue (55%) */}
            <div className="w-[55%] flex flex-col gap-6 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2">
                <div>
                  <h2 className="text-2xl font-display italic tracking-tight uppercase">Partai Siap Tanding</h2>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5 opacity-60">Menampilkan partai dengan kedua atlet sudah hadir.</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={loadMatches} 
                  className={`h-10 w-10 rounded-full hover:bg-foreground/5 transition-all ${loadingMatches ? 'animate-spin' : ''}`}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredMatches.map((match) => (
                    <Card 
                      key={match.id}
                      className={`group cursor-pointer transition-all duration-500 border border-foreground/[0.08] overflow-hidden rounded-[1.5rem] shadow-xl relative ${
                        selectedMatchId === match.id 
                          ? 'bg-foreground/[0.06] ring-2 ring-foreground/20' 
                          : 'bg-card/40 hover:bg-card/60'
                      }`}
                      onClick={() => setSelectedMatchId(match.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-xl font-display italic tracking-tight font-black">#{match.bout_number || match.match_number}</span>
                          <Badge variant="outline" className={`px-3 py-0.5 rounded-lg text-[8px] font-black tracking-widest uppercase border-foreground/10 ${match.status === 'called' ? 'bg-amber-500/10 text-amber-500' : 'bg-background/50'}`}>
                            {match.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-6">
                          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-background/60 border border-foreground/[0.05] shadow-sm">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                            <p className="text-sm font-bold tracking-tight truncate flex-1 uppercase">
                              {match.participants.find(p => p.corner === 'red')?.athlete_detail?.nama || 'BYE'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-background/60 border border-foreground/[0.05] shadow-sm">
                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                            <p className="text-sm font-bold tracking-tight truncate flex-1 uppercase">
                              {match.participants.find(p => p.corner === 'blue')?.athlete_detail?.nama || 'BYE'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-foreground/[0.05] flex justify-between items-center">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[150px] opacity-60">
                            {match.group_name}
                          </span>
                          <ChevronRight className="h-4 w-4 opacity-20 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-1 duration-300" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filteredMatches.length === 0 && (
                    <div className="col-span-full h-80 flex flex-col items-center justify-center text-muted-foreground/10 bg-secondary/5 rounded-[3rem] border-4 border-dashed border-foreground/5">
                      <Layout className="h-20 w-20 mb-4" />
                      <p className="font-display text-2xl tracking-tight opacity-40">Belum ada partai siap</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mt-2">Update otomatis aktif</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        @keyframes noise {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-1%, -1%); }
          20% { transform: translate(-2%, 1%); }
          30% { transform: translate(1%, -2%); }
          40% { transform: translate(-1%, 3%); }
          50% { transform: translate(-2%, 1%); }
          60% { transform: translate(3%, 0); }
          70% { transform: translate(0, 2%); }
          80% { transform: translate(-3%, 1%); }
          90% { transform: translate(1%, 2%); }
          100% { transform: translate(2%, 1%); }
        }

        .noise-overlay::before {
          content: "";
          position: fixed;
          top: -100%;
          left: -100%;
          right: -100%;
          bottom: -100%;
          background: url('https://grainy-gradients.vercel.app/noise.svg');
          opacity: 0.03;
          z-index: 100;
          pointer-events: none;
          animation: noise 0.5s steps(1) infinite;
        }
      `}</style>
    </main>
  );
}

function AthleteControlCard({ 
  participant, 
  corner, 
  onWin 
}: { 
  participant?: Participant; 
  corner: "red" | "blue"; 
  onWin: () => void;
}) {
  const isRed = corner === "red";
  
  return (
    <div className="flex flex-col gap-3">
      <Card className={`group relative overflow-hidden border border-foreground/[0.08] shadow-2xl rounded-[2rem] transition-all duration-500 bg-card/40 backdrop-blur-3xl`}>
        <div className={`h-1.5 w-full ${isRed ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`} />
        <CardContent className="p-8 space-y-6">
          <div>
            <p className={`text-[8px] font-black tracking-[0.2em] mb-1 ${isRed ? 'text-red-500' : 'text-blue-500'}`}>SUDUT {corner.toUpperCase()}</p>
            <h4 className="text-2xl font-display italic tracking-tight leading-tight mb-1 truncate">
              {participant?.athlete_detail?.nama || "BYE"}
            </h4>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {participant?.athlete_detail?.kontingen || "UMUM"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-foreground/[0.05]">
            <div className="text-center">
              <p className="text-[7px] text-muted-foreground font-black uppercase tracking-widest mb-1 opacity-60">SABUK / GENDER</p>
              <div className="flex flex-col items-center">
                <p className="font-display text-xs font-bold tracking-tight italic uppercase text-foreground/80">{participant?.athlete_detail?.sabuk_display || "-"}</p>
                <p className="text-[9px] font-black opacity-40">{participant?.athlete_detail?.gender_display || "-"}</p>
              </div>
            </div>
            <div className="text-center border-l border-foreground/[0.05]">
              <p className="text-[7px] text-muted-foreground font-black uppercase tracking-widest mb-1 opacity-60">BB / TB / UMUR</p>
              <div className="flex flex-col items-center">
                <p className="font-display text-sm tracking-tighter italic whitespace-nowrap font-bold">
                  {participant?.athlete_detail?.berat_kg || "0"}<span className="text-[8px] font-bold text-muted-foreground/40 ml-0.5">kg</span>
                  <span className="mx-1 opacity-20">/</span>
                  {participant?.athlete_detail?.tinggi_cm || "0"}<span className="text-[8px] font-bold text-muted-foreground/40 ml-0.5">cm</span>
                </p>
                <p className="text-[9px] font-black opacity-40">{participant?.athlete_detail?.umur || "0"} TAHUN</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-foreground/[0.05]">
            <div className="flex items-center justify-between">
               <p className="text-[7px] text-muted-foreground font-black uppercase tracking-widest opacity-60">KELAS</p>
               <span className="text-[9px] font-bold italic uppercase tracking-wider">{participant?.athlete_detail?.class_level || 'Prestasi'}</span>
            </div>
          </div>

        </CardContent>
      </Card>
      
      <Button 
        className={`h-20 text-3xl font-black italic tracking-tighter rounded-[1.5rem] transition-all active:scale-[0.95] shadow-xl relative overflow-hidden group/win ${
          isRed 
          ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20" 
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
        }`}
        onClick={onWin}
        disabled={!participant || participant.athlete === 0}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover/win:opacity-100 transition-opacity" />
        <span className="relative z-10">WINNER</span>
      </Button>
    </div>
  );
}
