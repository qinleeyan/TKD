"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { CheckCircle2, Loader2, RefreshCw, Search, UserCheck, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

type Athlete = {
  id: number;
  nama: string;
  kontingen?: string;
  umur: number;
  gender: number;
  tinggi_cm: number;
  berat_kg: number;
  is_checked_in: boolean;
  class_level?: string;
  klub?: string;
  sabuk_display?: string;
  gender_display?: string;
};

type Participant = {
  athlete: number;
  corner: "red" | "blue";
  athlete_detail?: Athlete;
};

type MatchRow = {
  id: number;
  bout_number?: number;
  match_number: number;
  status: string;
  group_name?: string;
  participants: Participant[];
};

const TOURNAMENT_ID = 1;

export default function RegistrasiPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [category, setCategory] = useState("kyourugi");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== "register" && user.role !== "superadmin")) {
        router.push("/dashboard");
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, authLoading, router]);

  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        tournament: TOURNAMENT_ID.toString(),
        category,
        page: page.toString(),
        page_size: pageSize.toString()
      });

      if (search) queryParams.append('search', search);

      const res = await fetchWithAuth(`/matches/?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.results || []);
        setTotalMatches(data.count || 0);
        setTotalPages(Math.ceil((data.count || 0) / pageSize));
      }
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [category, page, pageSize, search]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const { isConnected, broadcast } = useRealtime(TOURNAMENT_ID, useCallback((event, data) => {
    if (event === "athlete_checkin") {
        const athleteId = parseInt(data.id || data.athlete_id);
        const isHadir = data.is_checked_in;
        
        setMatches(prev => prev.map(m => ({
          ...m,
          participants: m.participants.map(p => 
            p.athlete === athleteId || p.athlete_detail?.id === athleteId
            ? { ...p, athlete_detail: p.athlete_detail ? { ...p.athlete_detail, is_checked_in: isHadir } : p.athlete_detail }
            : p
          )
        })));
        return;
    }

    if (event?.startsWith("match_") || event === "groups_confirmed" || event === "bulk_match_deleted") {
        loadMatches(true);
    }

    if (event === "match_deleted" && data?.id) {
      setMatches(prev => prev.filter(m => m.id !== data.id));
    }
  }, [loadMatches]));

  const stats = useMemo(() => {
    const participants = matches.flatMap((match) => match.participants);
    const present = participants.filter((participant) => participant.athlete_detail?.is_checked_in).length;
    return { total: participants.length, present, missing: participants.length - present };
  }, [matches]);

  const setPresence = async (athlete: Athlete, hadir: boolean) => {
    const athleteId = athlete.id;
    if (processingId === athleteId) return;
    
    // 🚀 OPTIMISTIC CLIENT BROADCAST (Zero-Latency Path)
    // Send notification to other admins IMMEDIATELY over WebSocket
    if (hadir) {
      broadcast("athlete_checkin", {
        id: athleteId,
        athlete_id: athleteId,
        nama: athlete.nama,
        kontingen: athlete.kontingen || "INDIVIDUAL",
        is_checked_in: true,
        msg_id: `client-opt-${athleteId}-${Date.now()}`
      });
    }

    // ⚡ OPTIMISTIC LOCAL STATE UPDATE
    setMatches(prev => prev.map(m => ({
      ...m,
      participants: m.participants.map(p => 
        p.athlete === athleteId || p.athlete_detail?.id === athleteId
        ? { ...p, athlete_detail: p.athlete_detail ? { ...p.athlete_detail, is_checked_in: hadir } : p.athlete_detail }
        : p
      )
    })));

    if (hadir) {
      toast.success(`${athlete.nama} ditandai hadir!`, {
        id: `athlete-checkin-${athleteId}`
      });
    }

    setProcessingId(athleteId);
    
    try {
        const res = await fetchWithAuth(`/athletes/${athleteId}/checkin/`, {
          method: "POST",
          body: JSON.stringify({ 
            is_checked_in: hadir,
            nama: athlete.nama,
            kontingen: athlete.kontingen || "INDIVIDUAL",
            tournament_id: TOURNAMENT_ID
          }),
        });
        if (!res.ok) {
           // Rollback
           setMatches(prev => prev.map(m => ({
             ...m,
             participants: m.participants.map(p => 
               p.athlete === athleteId || p.athlete_detail?.id === athleteId
               ? { ...p, athlete_detail: p.athlete_detail ? { ...p.athlete_detail, is_checked_in: !hadir } : p.athlete_detail }
               : p
             )
           })));
           toast.error("Gagal sinkronisasi ke server.");
        }
    } finally {
        setProcessingId(null);
    }
  };

  const filteredMatches = matches.filter((match) => {
    const text = `${match.bout_number || match.match_number} ${match.group_name || ""} ${match.participants.map((p) => p.athlete_detail?.nama || "").join(" ")}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "called") return match.status === "called";
    if (filter === "missing") return match.participants.some((participant) => !participant.athlete_detail?.is_checked_in);
    if (filter === "ready") return match.participants.length > 0 && match.participants.every((participant) => participant.athlete_detail?.is_checked_in);
    if (filter === "custom_range") {
      const bout = match.bout_number || match.match_number;
      const from = parseInt(rangeFrom) || 1;
      const to = parseInt(rangeTo) || 9999;
      return bout >= from && bout <= to;
    }
    return true;
  });

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

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-16 pt-28 lg:px-10">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <h1 className="mb-1 text-4xl font-display tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Registrasi Atlet</h1>
            <p className="text-sm text-muted-foreground font-medium">Manajemen kehadiran atlet untuk setiap partai pertandingan.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-secondary/30 p-2 rounded-2xl backdrop-blur-md border border-foreground/5 shadow-xl shadow-black/5">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                className="h-11 rounded-xl bg-background/50 border-none shadow-inner focus-visible:ring-1 focus-visible:ring-foreground/20 pl-10 transition-all hover:bg-background/80"
                placeholder="Cari atlet, kontingen, atau partai..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 h-11 bg-background/50 rounded-xl px-2 border border-foreground/5">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-[120px] border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kyourugi">Kyourugi</SelectItem>
                  <SelectItem value="poomsae">Poomsae</SelectItem>
                </SelectContent>
              </Select>
              <div className="w-px h-6 bg-foreground/10 mx-1" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-9 w-[130px] border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="custom_range">Filter Partai</SelectItem>
                  <SelectItem value="called">Sedang Dipanggil</SelectItem>
                  <SelectItem value="missing">Belum Hadir</SelectItem>
                  <SelectItem value="ready">Siap Tanding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filter === "custom_range" && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-xl border border-foreground/5 animate-in fade-in slide-in-from-right-2 duration-300">
                <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Partai</span>
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-8 w-14 rounded-lg bg-background/50 border-none px-2 text-center text-xs font-bold shadow-inner"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
                <span className="text-muted-foreground/30 font-bold">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-8 w-14 rounded-lg bg-background/50 border-none px-2 text-center text-xs font-bold shadow-inner"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </div>
            )}
            
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-background/50 hover:bg-background/80 transition-all active:scale-95 border border-foreground/5" onClick={() => loadMatches()}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="mb-10 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Stat title="Total Atlet Terdaftar" value={stats.total} icon={<UserCheck className="h-5 w-5 text-blue-500" />} />
          <Stat title="Sudah Hadir (Ready)" value={stats.present} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <Stat title="Belum Hadir" value={stats.missing} icon={<XCircle className="h-5 w-5 text-red-500" />} />
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-foreground/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredMatches.map((match) => (
              <Card key={match.id} className="group relative overflow-hidden rounded-3xl border-none bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-2xl shadow-2xl transition-all hover:shadow-black/10 hover:-translate-y-1">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500/20 via-foreground/5 to-blue-500/20 opacity-30" />
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10 text-foreground shadow-inner">
                        <span className="text-lg font-bold font-display">#{match.bout_number || match.match_number}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg font-display tracking-tight leading-tight">{match.group_name || "Match Info"}</CardTitle>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-0.5 border-foreground/10 text-[10px] font-bold uppercase tracking-wider bg-foreground/5">
                            Partai {match.match_number}
                          </Badge>
                          <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            match.status === 'called' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                            match.status === 'ready' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                            'bg-foreground/5 text-muted-foreground border-foreground/10'
                          }`}>
                            {match.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-0">
                  {match.participants.map((participant) => (
                    <div
                      key={`${match.id}-${participant.corner}`}
                      className={`group/athlete relative overflow-hidden rounded-xl border p-3 transition-all duration-300 ${
                        participant.corner === "red"
                          ? "border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/[0.02] hover:bg-red-500/15"
                          : "border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/[0.02] hover:bg-blue-500/15"
                      } ${participant.athlete_detail?.is_checked_in ? 'ring-1 ring-green-500/20 shadow-lg shadow-green-500/5' : ''}`}
                    >
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover/athlete:opacity-10 transition-opacity rotate-12">
                        {participant.corner === "red" ? (
                           <div className="h-24 w-24 rounded-full bg-red-500" />
                        ) : (
                           <div className="h-24 w-24 rounded-full bg-blue-500" />
                        )}
                      </div>

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
                              participant.corner === "red" ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20" : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
                            }`}
                          >
                            <span className="text-xs font-black uppercase">{participant.corner[0]}</span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-display text-lg tracking-tight font-semibold">{participant.athlete_detail?.nama || "-"}</p>
                              <span className="text-[10px] font-bold text-blue-500 uppercase px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                [{participant.athlete_detail?.klub || "UMUM"}]
                              </span>
                              {participant.athlete_detail?.is_checked_in && (
                                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500/20 border border-green-500/30">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 fill-green-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 mt-1">
                              <span className="text-foreground/90">{participant.athlete_detail?.kontingen || "INDIVIDUAL"}</span>
                              <span className="h-1 w-1 rounded-full bg-foreground/20" />
                              <span className="text-foreground/60">{participant.athlete_detail?.class_level || 'Prestasi'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-black text-foreground uppercase italic shadow-sm">
                                <span>{participant.athlete_detail?.sabuk_display || "PUTIH"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-muted-foreground uppercase">
                                <span>{participant.athlete_detail?.umur} TH</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-muted-foreground uppercase">
                                <span>{participant.athlete_detail?.berat_kg} KG</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-muted-foreground uppercase">
                                <span>{participant.athlete_detail?.tinggi_cm} CM</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-muted-foreground uppercase">
                                <span>{participant.athlete_detail?.gender_display}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {participant.athlete_detail && (
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              className={`h-10 w-10 rounded-xl p-0 transition-all ${
                                participant.athlete_detail.is_checked_in
                                  ? "bg-green-500 text-white hover:bg-green-600 hover:text-white shadow-lg shadow-green-500/20"
                                  : "bg-white/5 border border-white/10 hover:bg-white/10"
                              }`}
                              onClick={() => participant.athlete_detail && setPresence(participant.athlete_detail, !participant.athlete_detail?.is_checked_in)}
                            >
                              {participant.athlete_detail.is_checked_in ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <UserCheck className="h-5 w-5 opacity-40 group-hover/athlete:opacity-100 transition-opacity" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            {filteredMatches.length === 0 && (
              <Card className="rounded-3xl border-dashed border-2 border-foreground/10 bg-transparent lg:col-span-2">
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
                  <div className="h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 opacity-20" />
                  </div>
                  <p className="text-lg font-medium">Tidak ada partai ditemukan</p>
                  <p className="text-sm opacity-60">Coba ubah kata kunci pencarian atau filter Anda.</p>
                </CardContent>
              </Card>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-foreground/5 lg:col-span-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-mono font-bold tracking-tighter">
                    HALAMAN {page} DARI {totalPages}
                  </span>
                  <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">
                    TOTAL {totalMatches} PARTAI
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden rounded-3xl border-none bg-white/5 backdrop-blur-xl shadow-xl">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        {icon}
      </div>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 rounded-xl bg-white/5">
            {icon}
           </div>
           <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
        <p className="text-4xl font-display tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
