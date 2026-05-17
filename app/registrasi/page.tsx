"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import {
  CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw, Search,
  UserCheck, Users, XCircle, UserX, Shield
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

/* ─── Types ─── */
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

type GroupData = {
  id: number;
  group_name: string;
  match_category: string | number;
  gender: number;
  gender_display?: string;
  athlete_count?: number;
  athletes: Athlete[];
  assignments?: any[];
};

const TOURNAMENT_ID = 1;

/* ─── Helpers ─── */
function normalizeAthletes(raw: GroupData): Athlete[] {
  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
  if (assignments.length) {
    return assignments.map((a: any) => ({
      id: a.athlete_detail?.id ?? a.athlete ?? 0,
      nama: a.athlete_detail?.nama ?? "-",
      kontingen: a.athlete_detail?.kontingen ?? "",
      umur: a.athlete_detail?.umur ?? 0,
      gender: a.athlete_detail?.gender ?? 0,
      tinggi_cm: a.athlete_detail?.tinggi_cm ?? 0,
      berat_kg: a.athlete_detail?.berat_kg ?? 0,
      is_checked_in: a.athlete_detail?.is_checked_in ?? false,
      class_level: a.athlete_detail?.class_level ?? "",
      klub: a.athlete_detail?.klub ?? "",
      sabuk_display: a.athlete_detail?.sabuk_display ?? "",
      gender_display: a.athlete_detail?.gender_display ?? "",
    }));
  }
  return (raw.athletes || []).map((a: any) => ({
    id: a.id ?? 0,
    nama: a.nama ?? "-",
    kontingen: a.kontingen ?? "",
    umur: a.umur ?? 0,
    gender: a.gender ?? 0,
    tinggi_cm: a.tinggi_cm ?? 0,
    berat_kg: a.berat_kg ?? 0,
    is_checked_in: a.is_checked_in ?? false,
    class_level: a.class_level ?? "",
    klub: a.klub ?? "",
    sabuk_display: a.sabuk_display ?? "",
    gender_display: a.gender_display ?? "",
  }));
}

/* ─── Main Component ─── */
export default function RegistrasiPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<{ id: number; group_name: string; gender: number; gender_display?: string; match_category: string | number; athletes: Athlete[] }[]>([]);
  const [category, setCategory] = useState("kyourugi");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== "register" && user.role !== "superadmin")) {
        router.push("/dashboard");
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, authLoading, router]);

  /* ─── Load Groups (with athletes) ─── */
  const loadGroups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        tournament_id: TOURNAMENT_ID.toString(),
        category,
        page_size: "200",
      });
      if (search) params.append("search", search);

      const res = await fetchWithAuth(`/matches/weight-classes/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const results: GroupData[] = Array.isArray(data) ? data : (data.results || []);
        const normalized = results
          .map((g) => ({
            id: g.id,
            group_name: g.group_name || `Grup ${g.id}`,
            gender: Number(g.gender ?? 0),
            gender_display: g.gender_display,
            match_category: g.match_category,
            athletes: normalizeAthletes(g),
          }))
          .filter((g) => g.athletes.length > 0); // hide empty groups
        setGroups(normalized);
      }
    } catch (e) {
      console.error("Gagal memuat grup:", e);
      toast.error("Gagal memuat data grup.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  /* ─── WebSocket real-time ─── */
  const { broadcast } = useRealtime(TOURNAMENT_ID, useCallback((event: string, data: any) => {
    if (event === "athlete_checkin") {
      const athleteId = parseInt(data.id || data.athlete_id);
      const isHadir = data.is_checked_in;
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          athletes: g.athletes.map((a) =>
            a.id === athleteId ? { ...a, is_checked_in: isHadir } : a
          ),
        }))
      );
    }
    if (event === "groups_confirmed" || event === "bulk_match_deleted") {
      loadGroups(true);
    }
  }, [loadGroups]));

  /* ─── Toggle presence ─── */
  const setPresence = async (athlete: Athlete, hadir: boolean) => {
    if (processingIds.has(athlete.id)) return;

    // Optimistic broadcast
    if (hadir) {
      broadcast("athlete_checkin", {
        id: athlete.id, athlete_id: athlete.id, nama: athlete.nama,
        kontingen: athlete.kontingen || "INDIVIDUAL", is_checked_in: true,
        msg_id: `client-opt-${athlete.id}-${Date.now()}`
      });
    }

    // Optimistic local update
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        athletes: g.athletes.map((a) =>
          a.id === athlete.id ? { ...a, is_checked_in: hadir } : a
        ),
      }))
    );

    toast.success(`${athlete.nama} → ${hadir ? "Hadir ✓" : "Belum Hadir"}`, {
      id: `checkin-${athlete.id}`, duration: 1500,
    });

    setProcessingIds((prev) => new Set(prev).add(athlete.id));

    try {
      const res = await fetchWithAuth(`/athletes/${athlete.id}/checkin/`, {
        method: "POST",
        body: JSON.stringify({
          is_checked_in: hadir, nama: athlete.nama,
          kontingen: athlete.kontingen || "INDIVIDUAL",
          tournament_id: TOURNAMENT_ID,
        }),
      });
      if (!res.ok) {
        // Rollback
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            athletes: g.athletes.map((a) =>
              a.id === athlete.id ? { ...a, is_checked_in: !hadir } : a
            ),
          }))
        );
        toast.error("Gagal sinkronisasi ke server.");
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(athlete.id);
        return next;
      });
    }
  };

  /* ─── Toggle expand ─── */
  const toggleExpand = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(filteredGroups.map((g) => g.id)));
  };
  const collapseAll = () => setExpandedGroups(new Set());

  /* ─── Stats ─── */
  const allAthletes = useMemo(() => groups.flatMap((g) => g.athletes), [groups]);
  const stats = useMemo(() => {
    const uniqueMap = new Map<number, Athlete>();
    allAthletes.forEach((a) => uniqueMap.set(a.id, a));
    const unique = Array.from(uniqueMap.values());
    const present = unique.filter((a) => a.is_checked_in).length;
    return { total: unique.length, present, missing: unique.length - present };
  }, [allAthletes]);

  /* ─── Filtering ─── */
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Text search
      if (search) {
        const haystack = `${g.group_name} ${g.athletes.map((a) => `${a.nama} ${a.kontingen}`).join(" ")}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      // Status filter
      if (filter === "ready") return g.athletes.length > 0 && g.athletes.every((a) => a.is_checked_in);
      if (filter === "missing") return g.athletes.some((a) => !a.is_checked_in);
      if (filter === "partial") {
        const p = g.athletes.filter((a) => a.is_checked_in).length;
        return p > 0 && p < g.athletes.length;
      }
      return true;
    });
  }, [groups, search, filter]);

  /* ─── Auth loading ─── */
  if (authLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const presentPercent = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-background noise-overlay">
      <Navigation />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-16 pt-28 lg:px-10">
        {/* ─── Header ─── */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Shield className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-3xl font-display tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Absensi Kehadiran
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Kelola kehadiran atlet per kelas pertandingan
                </p>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 bg-secondary/30 p-2 rounded-2xl backdrop-blur-md border border-foreground/5 shadow-xl shadow-black/5">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                className="h-10 rounded-xl bg-background/50 border-none shadow-inner focus-visible:ring-1 focus-visible:ring-foreground/20 pl-9 text-sm"
                placeholder="Cari atlet atau kelas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); }}>
              <SelectTrigger className="h-10 w-[120px] rounded-xl bg-background/50 border-none shadow-inner text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kyourugi">Kyourugi</SelectItem>
                <SelectItem value="poomsae">Poomsae</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl bg-background/50 border-none shadow-inner text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                <SelectItem value="ready">✅ Semua Hadir</SelectItem>
                <SelectItem value="missing">❌ Ada Belum Hadir</SelectItem>
                <SelectItem value="partial">🔶 Hadir Sebagian</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-background/50 hover:bg-background/80 border border-foreground/5" onClick={() => loadGroups()}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ─── Stats Cards ─── */}
        <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-4">
          <StatCard title="Total Atlet" value={stats.total} icon={<Users className="h-5 w-5 text-blue-500" />} />
          <StatCard title="Sudah Hadir" value={stats.present} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} accent="emerald" />
          <StatCard title="Belum Hadir" value={stats.missing} icon={<UserX className="h-5 w-5 text-red-500" />} accent="red" />
          {/* Progress card */}
          <Card className="relative overflow-hidden rounded-2xl border-none bg-white/5 backdrop-blur-xl shadow-xl">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Progress Kehadiran</p>
              <p className="text-3xl font-display tracking-tight mb-3">{presentPercent}%</p>
              <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                  style={{ width: `${presentPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Expand/Collapse controls ─── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground font-medium">
            {filteredGroups.length} kelas ditemukan
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={expandAll}>
              Buka Semua
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={collapseAll}>
              Tutup Semua
            </Button>
          </div>
        </div>

        {/* ─── Group Cards ─── */}
        {loading ? (
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-foreground/20" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 border-foreground/10 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center min-h-[240px] text-muted-foreground">
              <Search className="h-8 w-8 opacity-20 mb-3" />
              <p className="text-lg font-medium">Tidak ada kelas ditemukan</p>
              <p className="text-sm opacity-60">Coba ubah filter atau kata kunci pencarian.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const presentCount = group.athletes.filter((a) => a.is_checked_in).length;
              const totalCount = group.athletes.length;
              const allPresent = presentCount === totalCount;
              const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

              return (
                <Card
                  key={group.id}
                  className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    allPresent
                      ? "border-emerald-500/30 bg-emerald-500/[0.02] shadow-lg shadow-emerald-500/5"
                      : "border-foreground/5 bg-white/[0.02] shadow-lg shadow-black/5"
                  }`}
                >
                  {/* Progress bar top accent */}
                  <div className="absolute top-0 left-0 w-full h-1">
                    <div
                      className={`h-full transition-all duration-700 ease-out rounded-r-full ${
                        allPresent ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-foreground/10"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* ─── Group Header (clickable) ─── */}
                  <button
                    className="w-full flex items-center justify-between p-4 pt-5 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                    onClick={() => toggleExpand(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        allPresent ? "bg-emerald-500/15 text-emerald-500" : "bg-foreground/5 text-foreground/50"
                      }`}>
                        {allPresent ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold tracking-tight leading-tight">{group.group_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold uppercase rounded-md border-foreground/10">
                            {group.gender === 0 ? "Putra" : "Putri"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Mini progress indicator */}
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-0.5">
                          {group.athletes.map((a) => (
                            <div
                              key={a.id}
                              className={`h-2.5 w-2.5 rounded-full border border-background transition-colors ${
                                a.is_checked_in ? "bg-emerald-500" : "bg-foreground/15"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${
                          allPresent ? "text-emerald-500" : presentCount > 0 ? "text-amber-500" : "text-muted-foreground"
                        }`}>
                          {presentCount}/{totalCount}
                        </span>
                      </div>

                      <div className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>

                  {/* ─── Expanded athlete list ─── */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="h-px bg-foreground/5 mb-3" />

                      {group.athletes.map((athlete) => {
                        const isProcessing = processingIds.has(athlete.id);
                        return (
                          <div
                            key={athlete.id}
                            className={`group/row relative flex items-center justify-between gap-3 rounded-xl p-3 transition-all duration-200 ${
                              athlete.is_checked_in
                                ? "bg-emerald-500/[0.06] border border-emerald-500/20"
                                : "bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Status dot */}
                              <div className={`relative flex h-3 w-3 shrink-0 ${athlete.is_checked_in ? "" : ""}`}>
                                <div className={`h-3 w-3 rounded-full ${
                                  athlete.is_checked_in ? "bg-emerald-500" : "bg-foreground/15"
                                }`} />
                                {athlete.is_checked_in && (
                                  <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-500 animate-ping opacity-30" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{athlete.nama}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {athlete.kontingen || "INDIVIDUAL"}
                                  </span>
                                  {athlete.klub && (
                                    <>
                                      <span className="h-1 w-1 rounded-full bg-foreground/20" />
                                      <span className="text-[10px] font-medium text-blue-500">{athlete.klub}</span>
                                    </>
                                  )}
                                  <span className="h-1 w-1 rounded-full bg-foreground/20" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {athlete.umur}th · {athlete.berat_kg}kg · {athlete.tinggi_cm}cm
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Check-in button */}
                            <Button
                              size="sm"
                              disabled={isProcessing}
                              className={`shrink-0 h-9 rounded-xl text-xs font-bold gap-1.5 transition-all duration-200 ${
                                athlete.is_checked_in
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                                  : "bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10"
                              }`}
                              onClick={() => setPresence(athlete, !athlete.is_checked_in)}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : athlete.is_checked_in ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5 opacity-50" />
                              )}
                              {athlete.is_checked_in ? "Hadir" : "Absen"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ─── Stat Card Component ─── */
function StatCard({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent?: string }) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border-none bg-white/5 backdrop-blur-xl shadow-xl">
      <div className="absolute top-0 right-0 p-4 opacity-10">{icon}</div>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 rounded-lg bg-white/5">{icon}</div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
        </div>
        <p className={`text-3xl font-display tracking-tight ${
          accent === "emerald" ? "text-emerald-500" : accent === "red" ? "text-red-500" : ""
        }`}>{value}</p>
      </CardContent>
    </Card>
  );
}
