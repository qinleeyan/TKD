"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navigation } from "@/components/landing/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BracketVisual } from "@/components/matches/bracket-visual";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL, WS_BASE_URL, fetchWithAuth, getAuthHeaders } from "@/lib/api";
import {
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  GripVertical,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Swords,
  Trash2,
  Upload,
  Users,
  X,
  Trophy,
  Activity,
  Play,
  CloudUpload,
  File,
  Search,
  Eye,
  Undo2,
  Eraser,
  ArrowRightSquare,
  UserCheck,
  FileText,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MoveHorizontal,
  Pencil,
  Building2,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

type Category = "kyourugi" | "poomsae";
type SortBy = "default" | "age" | "gender" | "weight" | "height";

type AthleteCard = {
  id?: number;
  client_id?: string;
  nama: string;
  umur: number;
  gender: number;
  gender_display?: string;
  tinggi_cm: number;
  berat_kg: number;
  sabuk: number | string;
  sabuk_display?: string;
  kontingen: string;
  klub?: string;
  class_level: string;
  is_checked_in?: boolean;
  position?: number;
};

type GroupCard = {
  id?: number;
  group_id?: number;
  group_name: string;
  match_category: Category;
  gender: number;
  gender_display?: string;
  sort_order: number;
  athlete_count?: number;
  age_min?: number;
  age_max?: number;
  height_min?: number;
  height_max?: number;
  weight_min?: number;
  weight_max?: number;
  fairness_score?: number;
  is_manual?: boolean;
  athletes: AthleteCard[];
  matches?: any[];
};

type MatchParticipant = {
  athlete: number;
  athlete_detail?: AthleteCard;
  corner: "red" | "blue";
};

type MatchRow = {
  id: number;
  round: number;
  arena?: number | null;
  arena_name?: string;
  match_number: number;
  bout_number?: number;
  status: string;
  group_name?: string;
  participants: MatchParticipant[];
  winner?: number | null;
};

type RoundRow = {
  id: number;
  weight_class_name: string;
  round_number: number;
};

const TOURNAMENT_ID = 1;

const statusLabels: Record<string, string> = {
  scheduled: "Terjadwal",
  called: "Dipanggil",
  ongoing: "Berlangsung",
  finished: "Selesai",
};

function groupKey(group: GroupCard, index?: number) {
  return String(group.id ?? group.group_id ?? `local-${index ?? 0}`);
}

function athleteKey(athlete: AthleteCard) {
  return String(athlete.id ?? athlete.client_id ?? athlete.nama);
}

function genderLabel(gender: number) {
  return gender === 0 ? "Laki-laki" : "Perempuan";
}

function GenderBadge({ gender }: { gender: number }) {
  return (
    <Badge className={`text-[8px] h-4 px-1.5 uppercase font-bold shadow-none border-none ${
      gender === 0 
        ? "bg-blue-500 hover:bg-blue-600 text-white" 
        : "bg-pink-500 hover:bg-pink-600 text-white"
    }`}>
      {gender === 0 ? "Putra" : "Putri"}
    </Badge>
  );
}

const sabukLabels: Record<number, string> = {
  0: "PUTIH",
  1: "KUNING",
  2: "KUNING STRIP",
  3: "HIJAU",
  4: "HIJAU STRIP",
  5: "BIRU",
  6: "BIRU STRIP",
  7: "MERAH",
  8: "MERAH STRIP I",
  9: "MERAH STRIP II",
  10: "DAN I",
  11: "DAN II",
};

function normalizeSabukCode(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 11) {
    return numeric;
  }

  const text = String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const labelMap: Record<string, number> = {
    putih: 0,
    white: 0,
    kuning: 1,
    yellow: 1,
    kuningstrip: 2,
    yellowstrip: 2,
    hijau: 3,
    green: 3,
    hijaustrip: 4,
    greenstrip: 4,
    biru: 5,
    blue: 5,
    birustrip: 6,
    bluestrip: 6,
    merah: 7,
    red: 7,
    merahstripi: 8,
    merahstrip1: 8,
    redstripi: 8,
    merahstripii: 9,
    merahstrip2: 9,
    redstripii: 9,
    dani: 10,
    dan1: 10,
    danii: 11,
    dan2: 11,
  };

  if (labelMap[text] !== undefined) return labelMap[text];
  if (text.includes("merahstripii") || text.includes("merahstrip2")) return 9;
  if (text.includes("merahstripi") || text.includes("merahstrip1")) return 8;
  if (text.includes("danii") || text.includes("dan2")) return 11;
  if (text.includes("dani") || text.includes("dan1")) return 10;
  for (const [label, code] of Object.entries(labelMap).sort((a, b) => b[0].length - a[0].length)) {
    if (text.includes(label)) return code;
  }

  return 0;
}

function sabukText(athlete: Partial<AthleteCard>) {
  const code = normalizeSabukCode(athlete.sabuk);
  const label = athlete.sabuk_display || sabukLabels[code] || "PUTIH";
  return `SABUK ${code} - ${label}`;
}

function normalizeGroup(raw: any, index: number): GroupCard {
  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
  const athletes = assignments.length
    ? assignments.map((assignment: any) => ({
      ...(assignment.athlete_detail || {}),
      sabuk: normalizeSabukCode(assignment.athlete_detail?.sabuk),
      sabuk_display: assignment.athlete_detail?.sabuk_display || sabukLabels[normalizeSabukCode(assignment.athlete_detail?.sabuk)],
      gender_display: assignment.athlete_detail?.gender_display,
      kontingen: assignment.athlete_detail?.kontingen ?? assignment.athlete_detail?.Kontingen ?? "",
      klub: assignment.athlete_detail?.klub ?? assignment.athlete_detail?.Klub ?? assignment.athlete_detail?.Club ?? "",
      class_level: String(assignment.athlete_detail?.class_level ?? assignment.athlete_detail?.Kelas ?? "1"),
      position: assignment.position,
    }))
    : (raw.athletes || []).map((a: any, athleteIndex: number) => ({
      ...a,
      sabuk: normalizeSabukCode(a.sabuk),
      sabuk_display: a.sabuk_display || sabukLabels[normalizeSabukCode(a.sabuk)],
      gender_display: a.gender_display,
      kontingen: a.kontingen ?? a.Kontingen ?? "",
      klub: a.klub ?? a.Klub ?? a.Club ?? "",
      class_level: String(a.class_level ?? a.Kelas ?? "1"),
      position: a.position ?? athleteIndex + 1,
    }));

  return {
    id: raw.id,
    group_id: raw.group_id ?? raw.id ?? index + 1,
    group_name: raw.group_name || raw.category_name || `Grup ${index + 1}`,
    match_category: (raw.match_category || "kyourugi") as Category,
    gender: Number(raw.gender ?? athletes[0]?.gender ?? 0),
    gender_display: raw.gender_display || genderLabel(Number(raw.gender ?? athletes[0]?.gender ?? 0)),
    sort_order: Number(raw.sort_order ?? index + 1),
    athlete_count: raw.athlete_count ?? athletes.length,
    age_min: raw.age_min,
    age_max: raw.age_max,
    height_min: raw.height_min,
    height_max: raw.height_max,
    weight_min: raw.weight_min,
    weight_max: raw.weight_max,
    fairness_score: raw.fairness_score,
    is_manual: raw.is_manual,
    athletes,
    matches: Array.isArray(raw.matches) ? raw.matches : raw.simulated_bracket,
  };
}

function groupMetric(group: GroupCard, sortBy: SortBy) {
  const athletes = Array.isArray(group.athletes) ? group.athletes : [];
  const ages = athletes.map((a) => a.umur || 0);
  const heights = athletes.map((a) => a.tinggi_cm || 0);
  const weights = athletes.map((a) => a.berat_kg || 0);

  if (sortBy === "default") return group.sort_order ?? group.id ?? 0;
  if (sortBy === "age") return group.age_min ?? (ages.length ? Math.min(...ages) : 0);
  if (sortBy === "gender") return group.gender;
  if (sortBy === "height") return group.height_min ?? (heights.length ? Math.min(...heights) : 0);
  return group.weight_min ?? (weights.length ? Math.min(...weights) : 0);
}

export default function MatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteCard[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>("kyourugi");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [matchPage, setMatchPage] = useState(1);
  const [matchTotalPages, setMatchTotalPages] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [groupTotalPages, setGroupTotalPages] = useState(1);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  const [hasLoadedBrackets, setHasLoadedBrackets] = useState(false);
  const [isAthletesLoading, setIsAthletesLoading] = useState(true);
  const [isRoundsLoading, setIsRoundsLoading] = useState(true);
  const [isMatchesLoading, setIsMatchesLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== "match" && user.role !== "superadmin")) {
        router.push("/dashboard");
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, authLoading, router]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // --- ATHLETE DASHBOARD & MANAGEMENT STATE ---
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athleteGenderFilter, setAthleteGenderFilter] = useState("all");
  const [athleteBeltFilter, setAthleteBeltFilter] = useState("all");
  const [athleteClubFilter, setAthleteClubFilter] = useState("all");
  const [athleteAgeMin, setAthleteAgeMin] = useState("");
  const [athleteAgeMax, setAthleteAgeMax] = useState("");
  const [athleteWeightMin, setAthleteWeightMin] = useState("");
  const [athleteWeightMax, setAthleteWeightMax] = useState("");
  const [athleteHeightMin, setAthleteHeightMin] = useState("");
  const [athleteHeightMax, setAthleteHeightMax] = useState("");

  const [editingAthlete, setEditingAthlete] = useState<AthleteCard | null>(null);
  const [athleteDialogOpen, setAthleteDialogOpen] = useState(false);

  const stats = useMemo(() => {
    const total = athletes.length;
    const male = athletes.filter(a => a.gender === 0).length;
    const female = athletes.filter(a => a.gender === 1).length;
    // Category stats are based on selectedCategory, not per-athlete
    const kyorugi = selectedCategory === 'kyourugi' ? total : 0;
    const poomsae = selectedCategory === 'poomsae' ? total : 0;
    const prestasi = athletes.filter(a => a.class_level === '1').length;
    const pemula = athletes.filter(a => a.class_level === '0').length;
    const groupsCount = groups.length;

    return { total, male, female, kyorugi, poomsae, prestasi, pemula, groupsCount };
  }, [athletes, groups, selectedCategory]);

  const uniqueClubs = useMemo(() => {
    const clubs = athletes.map(a => a.klub).filter(Boolean) as string[];
    return Array.from(new Set(clubs)).sort();
  }, [athletes]);

  const filteredAthleteList = useMemo(() => {
    return athletes.filter(a => {
      const matchesSearch = !athleteSearch ||
        a.nama.toLowerCase().includes(athleteSearch.toLowerCase()) ||
        (a.klub || "").toLowerCase().includes(athleteSearch.toLowerCase());

      const matchesGender = athleteGenderFilter === "all" || String(a.gender) === athleteGenderFilter;
      const matchesBelt = athleteBeltFilter === "all" || String(a.sabuk) === athleteBeltFilter;
      const matchesClub = athleteClubFilter === "all" || a.klub === athleteClubFilter;

      const ageMin = athleteAgeMin ? parseInt(athleteAgeMin) : 0;
      const ageMax = athleteAgeMax ? parseInt(athleteAgeMax) : 100;
      const matchesAge = a.umur >= ageMin && a.umur <= ageMax;

      const weightMin = athleteWeightMin ? parseFloat(athleteWeightMin) : 0;
      const weightMax = athleteWeightMax ? parseFloat(athleteWeightMax) : 500;
      const matchesWeight = a.berat_kg >= weightMin && a.berat_kg <= weightMax;

      const heightMin = athleteHeightMin ? parseFloat(athleteHeightMin) : 0;
      const heightMax = athleteHeightMax ? parseFloat(athleteHeightMax) : 300;
      const matchesHeight = a.tinggi_cm >= heightMin && a.tinggi_cm <= heightMax;

      return matchesSearch && matchesGender && matchesBelt && matchesClub && matchesAge && matchesWeight && matchesHeight;
    });
  }, [athletes, athleteSearch, athleteGenderFilter, athleteBeltFilter, athleteClubFilter, athleteAgeMin, athleteAgeMax, athleteWeightMin, athleteWeightMax, athleteHeightMin, athleteHeightMax]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupCard | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchRow | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", gender: "0" });
  const [draggedAthlete, setDraggedAthlete] = useState<{ athleteId: string; fromGroup: string } | null>(null);
  const [movingAthlete, setMovingAthlete] = useState<{ athlete: AthleteCard; fromGroup: string } | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveGroupSearch, setMoveGroupSearch] = useState("");
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewGender, setPreviewGender] = useState<string>("all");
  const [previewClass, setPreviewClass] = useState<string>("all");
  const [poomsaePool, setPoomsaePool] = useState<AthleteCard[]>([]);
  const [selectedPoolAthletes, setSelectedPoolAthletes] = useState<string[]>([]);
  const [poolSabukFilter, setPoolSabukFilter] = useState<string>("all");
  const [poolAgeFilter, setPoolAgeFilter] = useState<string>("all");
  const [poolSearch, setPoolSearch] = useState("");
  const [activePoolTab, setActivePoolTab] = useState<"available" | "selected">("available");
  const [arenas, setArenas] = useState<any[]>([]);

  const [mainSearch, setMainSearch] = useState("");
  const [mainGenderFilter, setMainGenderFilter] = useState("all");
  const [matchSearch, setMatchSearch] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("all");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isDeletingGroups, setIsDeletingGroups] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [realtimeStats, setRealtimeStats] = useState({
    total_athletes: 0,
    total_groups: 0,
    total_matches: 0,
    total_arenas: 0
  });
  const [matchForm, setMatchForm] = useState({ round: "", match_number: "1", bout_number: "", status: "scheduled", red: "", blue: "", arena: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [gladiatorDialogOpen, setGladiatorDialogOpen] = useState(false);
  const [gladiatorForm, setGladiatorForm] = useState({
    arena_id: "",
    bout_number: "",
    red: { id: null as number | null, nama: "", kontingen: "" },
    blue: { id: null as number | null, nama: "", kontingen: "" }
  });
  const [redSearchQuery, setRedSearchQuery] = useState("");
  const [blueSearchQuery, setBlueSearchQuery] = useState("");

  const filteredRedAthletes = useMemo(() => {
    if (!redSearchQuery) return [];
    return athletes.filter(a => a.nama.toLowerCase().includes(redSearchQuery.toLowerCase())).slice(0, 5);
  }, [athletes, redSearchQuery]);

  const filteredBlueAthletes = useMemo(() => {
    if (!blueSearchQuery) return [];
    return athletes.filter(a => a.nama.toLowerCase().includes(blueSearchQuery.toLowerCase())).slice(0, 5);
  }, [athletes, blueSearchQuery]);

  const handleCreateGladiator = async () => {
    if (!gladiatorForm.red.nama || !gladiatorForm.blue.nama) {
      toast.error("Nama atlet (Merah & Biru) wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tournament_id: TOURNAMENT_ID,
        arena_id: gladiatorForm.arena_id,
        bout_number: gladiatorForm.bout_number,
        red_athlete: gladiatorForm.red,
        blue_athlete: gladiatorForm.blue
      };

      const res = await fetchWithAuth("/matches/gladiator/", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Match Gladiator berhasil dibuat!");
        setGladiatorForm({
          arena_id: "",
          bout_number: "",
          red: { id: null, nama: "", kontingen: "" },
          blue: { id: null, nama: "", kontingen: "" }
        });
        setRedSearchQuery("");
        setBlueSearchQuery("");
        // loadMatches(true); // Dihapus biar full real-time dari WebSocket
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal membuat match.");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  };


  useEffect(() => {
    setMatchPage(1);
  }, [matchSearch, matchStatusFilter, selectedCategory]);

  useEffect(() => {
    setGroupPage(1);
  }, [mainSearch, mainGenderFilter, selectedCategory]);

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (matchStatusFilter !== "all") {
      result = result.filter(m => m.status === matchStatusFilter);
    }
    if (matchSearch) {
      const query = String(matchSearch).toLowerCase();
      result = result.filter(m => {
        if (!m) return false;
        try {
          const boutStr = m.bout_number ? String(m.bout_number).toLowerCase() : "";
          const matchNumStr = m.match_number ? String(m.match_number).toLowerCase() : "";
          const arenaStr = m.arena_name ? String(m.arena_name).toLowerCase() : "";
          const groupStr = m.group_name ? String(m.group_name).toLowerCase() : "";
          
          const hasAthleteMatch = (m.participants || []).some(p => {
            const athleteName = p.athlete_detail?.nama || p.athlete_name || "";
            return String(athleteName).toLowerCase().includes(query);
          });

          return boutStr.includes(query) || 
                 matchNumStr.includes(query) || 
                 arenaStr.includes(query) || 
                 groupStr.includes(query) ||
                 hasAthleteMatch;
        } catch (e) {
          console.error("Filter error:", e, m);
          return false;
        }
      });
    }
    return result;
  }, [matches, matchSearch, matchStatusFilter]);

  const filteredGroups = useMemo(() => {
    let result = Array.isArray(groups) ? [...groups] : [];

    // Client-side category filtering
    if (selectedCategory !== "all") {
      const catVal = (selectedCategory === "poomsae" || selectedCategory === "1") ? 1 : 0;
      result = result.filter(g => g && g.match_category == catVal);
    }

    // Client-side gender filtering
    if (mainGenderFilter !== "all") {
      result = result.filter(g => g && g.gender == mainGenderFilter);
    }

    if (mainSearch) {
      const query = String(mainSearch).toLowerCase();
      result = result.filter(g => {
        if (!g) return false;
        try {
          const nameMatch = (g.group_name || g.category_name || "").toLowerCase().includes(query);
          const athleteMatch = (g.athletes || g.assignments || []).some(a => {
            const athleteName = a.nama || a.athlete_detail?.nama || "";
            const athleteKlub = a.klub || a.athlete_detail?.klub || "";
            return String(athleteName).toLowerCase().includes(query) || 
                   String(athleteKlub).toLowerCase().includes(query);
          });
          return nameMatch || athleteMatch;
        } catch (e) {
          console.error("Group filter error:", e, g);
          return false;
        }
      });
    }
    return result;
  }, [groups, mainSearch, mainGenderFilter, selectedCategory]);

  const groupedMatches = useMemo(() => {
    return matches.reduce<Record<string, MatchRow[]>>((acc, match) => {
      const key = match.status || "scheduled";
      acc[key] = acc[key] || [];
      acc[key].push(match);
      return acc;
    }, {});
  }, [matches]);

  const loadGroups = useCallback(async (silent = false, withMatches = false) => {
    if (!silent) setLoading(true);
    setIsGroupsLoading(true);
    try {
      // Use a larger page size to enable better local filtering and prevent delay
      const matchFlag = withMatches ? "1" : "0";
      let url = `/matches/weight-classes/?tournament=${TOURNAMENT_ID}&category=all&gender=all&page_size=500&include_matches=${matchFlag}`;
      
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        const validResults = results.filter(Boolean);
        setGroups(validResults.map((item: any, index: number) => normalizeGroup(item, index)));
        if (data.count) setGroupTotalPages(Math.ceil(data.count / 200));
      }
    } catch {
      toast.error("Gagal memuat grup.");
    } finally {
      if (!silent) setLoading(false);
      setIsGroupsLoading(false);
    }
  }, [selectedCategory, groupPage, mainGenderFilter]);

  const loadMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setIsMatchesLoading(true);
    try {
      let url = `/matches/?tournament=${TOURNAMENT_ID}&category=${selectedCategory}&status=${matchStatusFilter}&page_size=200`;
      
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        setMatches(results);
        if (data.count) setMatchTotalPages(Math.ceil(data.count / 200));
      }
    } catch {
      toast.error("Gagal memuat match.");
    } finally {
      if (!silent) setLoading(false);
      setIsMatchesLoading(false);
    }
  }, [selectedCategory, matchPage, matchStatusFilter]);

  const loadRounds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRoundsLoading(true);
    try {
      const res = await fetchWithAuth(`/matches/rounds/?tournament=${TOURNAMENT_ID}&match_category=${selectedCategory}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        setRounds(results);
      }
    } catch {
      toast.error("Gagal memuat ronde.");
    } finally {
      if (!silent) setLoading(false);
      setIsRoundsLoading(false);
    }
  }, [selectedCategory]);

  const loadAthletes = useCallback(async () => {
    setIsAthletesLoading(true);
    try {
      const res = await fetchWithAuth(`/athletes/?tournament=${TOURNAMENT_ID}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        setAthletes(results);
      }
    } catch (e) {
      console.error("Gagal memuat atlet:", e);
    } finally {
      setIsAthletesLoading(false);
    }
  }, []);

  const loadArenas = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/arenas/?tournament=${TOURNAMENT_ID}`);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        setArenas(results);
      }
    } catch (e) {
      console.error("Gagal memuat arena:", e);
    }
  }, []);

  // --- Data Loading Optimization (Targeted Fetching) ---
  useEffect(() => {
    loadGroups(true);
    loadAthletes(true);
  }, [loadGroups, loadAthletes]);

  useEffect(() => {
    loadMatches(true);
  }, [selectedCategory, matchPage, matchStatusFilter, loadMatches]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRounds(true), loadAthletes(), loadArenas()]).finally(() => {
      setLoading(false);
    });
  }, [selectedCategory, loadRounds, loadAthletes, loadArenas]);

  // --- Real-time Real-time (Zero Latency) ---
  useRealtime(TOURNAMENT_ID, useCallback((event, data) => {
    if (["processing_start", "processing_parsing", "processing_clustering", "processing_complete"].includes(event)) {
      setProgressMessage(data?.message || "");
      if (event === "processing_complete") {
        setTimeout(() => setProgressMessage(""), 3000);
      }
    }

    if (event === "processing_error") {
      toast.error(data?.message || "Gagal memproses data.");
      setProgressMessage("");
      setUploading(false);
      setSaving(false);
    }

    if (event === "export_progress" && data) {
      toast.loading(data.message || `Exporting... ${data.progress}%`, { id: "export_progress_toast" });
      return;
    }

    // Direct Data Updates (Zero Latency - No API Fetch)
    // Direct Data Updates (Zero Latency - No API Fetch)
    if ((event === "groups_confirmed" || event === "preview_ready") && data?.groups) {
      setGroups(data.groups.map((item: any, index: number) => normalizeGroup(item, index)));
      setHasUnsavedChanges(false);
      setUploading(false);
      setSaving(false);
      setPreviewDialogOpen(false);
      
      // If confirmed, refresh matches and rounds to update Bracket tab
      if (event === "groups_confirmed") {
        loadMatches(true);
        loadRounds(true);
      }

      // If poomsae, also prepare the pool (all athletes)
      if (data.category === 1 || selectedCategory === "poomsae") {
        const allAthletes = data.groups.flatMap((g: any) => g.athletes);
        setPoomsaePool(allAthletes);
      }

      toast.success(data.message || (event === "preview_ready" ? "Preview grouping siap!" : "Grouping & Bracket disinkronisasi."));
      return;
    }

    if (["match_updated", "match_created", "match_called", "match_started", "match_finished"].includes(event) && data?.id) {
      setMatches(prev => {
        const results = Array.isArray(prev) ? prev : [];
        const exists = results.find(m => m.id === data.id);
        if (exists) {
          return results.map(m => m.id === data.id ? { ...m, ...data } : m);
        }
        if (event === "match_created") {
          return [...results, data];
        }
        return results;
      });

      // Update groups locally so bracket visualizer updates in real-time
      setGroups(prev => (Array.isArray(prev) ? prev : []).map(g => {
        let hasMatch = false;
        const updatedMatches = (g.matches || []).map((m: any) => {
          if (m.id === data.id) {
            hasMatch = true;
            return { ...m, ...data };
          }
          return m;
        });

        if (hasMatch || g.group_name === data.group_name) {
          if (!hasMatch && event === "match_created") {
            updatedMatches.push(data);
          }
          return { ...g, matches: updatedMatches, status: data.status === "finished" ? "updated" : g.status };
        }
        return g;
      }));
      return;
    }

    if (event === "bulk_athlete_deleted") {
      const isReset = data?.is_reset;
      if (isReset) {
        setGroups([]);
        setMatches([]);
        setRealtimeStats({
          total_athletes: 0,
          total_groups: 0,
          total_matches: 0,
          total_arenas: 0
        });
      } else {
        // If specific IDs deleted, refresh everything to be safe
        loadGroups(true);
        loadMatches(true);
      }
      return;
    }

    if (event === "match_deleted" && data?.id) {
      setMatches(prev => prev.filter(m => m.id !== data.id));
      return;
    }

    if (event === "bulk_match_deleted") {
      loadMatches(true);
      return;
    }

    if (event === "bulk_group_deleted") {
      loadGroups(true);
      return;
    }

    if (event === "group_updated" && data?.id) {
      setGroups(prev => prev.map(g => g.id === data.id ? normalizeGroup(data, 0) : g));
      return;
    }

    if (event === "group_deleted" && data?.id) {
      setGroups(prev => prev.filter(g => g.id !== data.id));
      return;
    }

    if (["athlete_created", "athlete_updated"].includes(event) && data) {
      setAthletes(prev => {
        const results = Array.isArray(prev) ? prev : [];
        const exists = results.find(a => a.id === data.id);
        if (exists) {
          return results.map(a => a.id === data.id ? { ...a, ...data } : a);
        }
        if (event === "athlete_created") {
          return [data, ...results];
        }
        return results;
      });
      return;
    }

    if (event === "athlete_deleted" && data?.id) {
      setAthletes(prev => prev.filter(a => a.id !== data.id));
      return;
    }

    if (event === "athlete_checkin") {
      const isHadir = data?.is_checked_in;
      const athleteId = parseInt(data.id || data.athlete_id);

      if (isHadir && !data?.final_sync) {
        toast.success(`${data.nama || 'Atlet'} (${data.kontingen || 'Umum'}) sudah hadir!`, {
          id: `athlete-checkin-${athleteId}`,
          description: "Atlet siap untuk dipanggil tanding.",
          duration: 5000,
        });
      }

      setAthletes(prev => (Array.isArray(prev) ? prev : []).map(a => a.id === athleteId ? { ...a, is_checked_in: isHadir } : a));
      
      setMatches(prev => (Array.isArray(prev) ? prev : []).map(m => ({
        ...m,
        participants: (m.participants || []).map(p =>
          (p.athlete === athleteId || p.athlete_detail?.id === athleteId)
            ? { ...p, athlete_detail: p.athlete_detail ? { ...p.athlete_detail, is_checked_in: isHadir } : p.athlete_detail }
            : p
        )
      })));

      setGroups(prev => (Array.isArray(prev) ? prev : []).map(g => ({
        ...g,
        athletes: (g.athletes || []).map(a => a.id === athleteId ? { ...a, is_checked_in: isHadir } : a)
      })));
      return;
    }

    if (event === "athlete_created" && data?.id) {
      toast.info(`📢 ${data.nama} baru saja mendaftar!`, {
        id: `created-${data.id}`,
        description: `Kontingen: ${data.kontingen || 'Umum'}`,
        duration: 5000,
      });
      setAthletes(prev => {
        const results = Array.isArray(prev) ? prev : [];
        if (results.find(a => a.id === data.id)) return results;
        return [...results, data];
      });
      return;
    }

    if (event === "athlete_updated" && data?.id) {
      setAthletes(prev => (Array.isArray(prev) ? prev : []).map(a => a.id === data.id ? { ...a, ...data } : a));
      setGroups(prev => (Array.isArray(prev) ? prev : []).map(g => ({
        ...g,
        athletes: (g.athletes || []).map(a => a.id === data.id ? { ...a, ...data } : a)
      })));
      return;
    }

    if (event === "athlete_deleted" && data?.id) {
      setAthletes(prev => (Array.isArray(prev) ? prev : []).filter(a => a.id !== data.id));
      setGroups(prev => (Array.isArray(prev) ? prev : []).map(g => ({
        ...g,
        athletes: (g.athletes || []).filter(a => a.id !== data.id)
      })));
      return;
    }

    if (event === "match_finished") {
      toast.success(`🏆 ${data.winner_name} memenangkan partai #${data.bout_number || data.match_number}!`, {
        id: `match-${data.id}`,
        description: `Sudut ${data.winner_corner?.toUpperCase()} melaju ke babak selanjutnya.`,
        duration: 8000,
      });
    }
  }, [normalizeGroup, loadAthletes]));

  const applySort = (value: SortBy) => {
    setSortBy(value);
    setGroups((current) =>
      [...current]
        .sort((a, b) => groupMetric(a, value) - groupMetric(b, value))
        .map((group, index) => ({ ...group, sort_order: index + 1 })),
    );
    setHasUnsavedChanges(true);
  };

  const moveAthlete = (fromGroupKey: string, targetGroupKey: string, selectedAthleteKey: string) => {
    if (fromGroupKey === targetGroupKey) return;

    const source = groups.find((group, index) => groupKey(group, index) === fromGroupKey);
    const target = groups.find((group, index) => groupKey(group, index) === targetGroupKey);
    const athlete = source?.athletes.find((item) => athleteKey(item) === selectedAthleteKey);
    if (!source || !target || !athlete) return;

    if (target.athletes.length > 0 && target.gender !== athlete.gender) {
      toast.error("Gender dalam satu kelompok wajib sama.");
      return;
    }

    setGroups((current) =>
      current.map((group, index) => {
        const key = groupKey(group, index);
        if (key === fromGroupKey) {
          return { ...group, athletes: group.athletes.filter((item) => athleteKey(item) !== selectedAthleteKey) };
        }
        if (key === targetGroupKey) {
          return {
            ...group,
            gender: athlete.gender,
            gender_display: genderLabel(athlete.gender),
            athletes: [...group.athletes, { ...athlete, position: group.athletes.length + 1 }],
          };
        }
        return group;
      }),
    );
    setHasUnsavedChanges(true);
  };

  const removeAthlete = (targetGroupKey: string, selectedAthleteKey: string) => {
    if (selectedCategory === "poomsae") {
      returnToPool(targetGroupKey, selectedAthleteKey);
      return;
    }
    setGroups((current) =>
      current.map((group, index) =>
        groupKey(group, index) === targetGroupKey
          ? { ...group, athletes: group.athletes.filter((athlete) => athleteKey(athlete) !== selectedAthleteKey) }
          : group,
      ),
    );
    setHasUnsavedChanges(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.name.endsWith(".xls") || droppedFile.name.endsWith(".xlsx"))) {
      setFile(droppedFile);
    } else {
      toast.error("Format file tidak didukung. Gunakan CSV, XLS, atau XLSX.");
    }
  };

  const clearAllGroups = () => {
    setGroups([]);
    toast.info("Semua kelompok dibersihkan. Silakan buat kelompok manual.");
  };

  const createManualGroup = () => {
    if (selectedPoolAthletes.length === 0) {
      toast.error("Pilih setidaknya satu atlet.");
      return;
    }

    const selectedAthletesData = poomsaePool.filter(a => selectedPoolAthletes.includes(athleteKey(a)));

    // Auto-name based on belt and age if they match, else generic
    const first = selectedAthletesData[0];
    const allSameSabuk = selectedAthletesData.every(a => a.sabuk === first.sabuk);
    const allSameAge = selectedAthletesData.every(a => a.umur === first.umur);

    let groupName = `Kelompok ${groups.length + 1}`;
    if (allSameSabuk && allSameAge) {
      groupName = `Poomsae Sabuk ${first.sabuk} ${first.umur}th - ${groups.length + 1}`;
    }

    const newGroup: GroupCard = {
      group_id: Date.now(),
      group_name: groupName,
      match_category: selectedCategory,
      gender: first.gender,
      gender_display: genderLabel(first.gender),
      sort_order: groups.length + 1,
      athletes: selectedAthletesData,
      is_manual: true
    };

    setGroups([...groups, newGroup]);

    // Remove from pool
    setPoomsaePool(poomsaePool.filter(a => !selectedPoolAthletes.includes(athleteKey(a))));
    setSelectedPoolAthletes([]);
    toast.success(`${selectedAthletesData.length} atlet dimasukkan ke ${groupName}`);
  };

  const togglePoolAthlete = (id: string) => {
    setSelectedPoolAthletes(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const returnToPool = (groupKeyVal: string, athleteId: string) => {
    const group = groups.find((g, idx) => groupKey(g, idx) === groupKeyVal);
    if (!group) return;

    const athlete = group.athletes.find(a => athleteKey(a) === athleteId);
    if (!athlete) return;

    // Remove from group
    const newGroups = groups.map((g, idx) => {
      if (groupKey(g, idx) === groupKeyVal) {
        return { ...g, athletes: g.athletes.filter(a => athleteKey(a) !== athleteId) };
      }
      return g;
    }).filter(g => g.athletes.length > 0);

    setGroups(newGroups);
    setPoomsaePool([...poomsaePool, athlete]);
    toast.info(`${athlete.nama} dikembalikan ke pool.`);
  };

  const handlePreviewUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tournament_id", String(TOURNAMENT_ID));
    formData.append("category", selectedCategory);

    try {
      setGroups([]); // Clear old groups
      setPreviewDialogOpen(true); // Open dialog immediately to show progress
      setUploadDialogOpen(false);

      const res = await fetchWithAuth("/matchmaking/preview-upload/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (res.status === 202) {
        // Backend processing in background
        toast.info(data.message || "Menganalisis file di latar belakang...");
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Gagal memproses file.");
        setProgressMessage("");
        setPreviewDialogOpen(false); // Close if error
        return;
      }
      const normalized = (data.groups || []).map((item: any, index: number) => normalizeGroup(item, index));
      setGroups(normalized);

      // If poomsae, also prepare the pool (all athletes)
      if (selectedCategory === "poomsae") {
        const allAthletes = normalized.flatMap((g: any) => g.athletes);
        setPoomsaePool(allAthletes);
      } else {
        setPoomsaePool([]);
      }

      setHasUnsavedChanges(true);
      toast.success("Preview grouping siap dicek.");
    } catch {
      toast.error("Tidak dapat menghubungi backend.");
      setPreviewDialogOpen(false);
      setUploading(false);
    }
    // Note: We don't set uploading=false in finally here 
    // because background tasks (202) need to keep the state.
  };

  const handleConfirmGroups = async () => {
    setSaving(true);
    const payloadGroups = groups.map((group, index) => ({
      ...group,
      group_name: group.group_name,
      sort_order: index + 1,
      athletes: group.athletes.map((athlete, athleteIndex) => ({
        ...athlete,
        position: athleteIndex + 1,
      })),
    }));

    try {
      const res = await fetchWithAuth("/matchmaking/confirm-groups/", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: TOURNAMENT_ID,
          category: selectedCategory,
          replace_existing: true,
          groups: payloadGroups,
        }),
      });
      const data = await res.json();
      
      if (res.status === 202) {
        // Backend processing in background - Keep saving=true
        toast.info(data.message || "Proses sinkronisasi dimulai...");
        // Close preview dialog so user can see the progress on the main dashboard
        setPreviewDialogOpen(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan grouping.");
        setSaving(false);
        return;
      }

      // Fallback for direct response
      if (data.groups) {
        setGroups((data.groups || []).map((item: any, index: number) => normalizeGroup(item, index)));
        setPreviewDialogOpen(false);
        setHasUnsavedChanges(false);
        setSaving(false);
        await Promise.all([loadMatches(), loadRounds()]);
        toast.success("Grouping tersimpan dan bracket dibuat.");
      }
    } catch {
      toast.error("Tidak dapat menyimpan grouping.");
      setSaving(false);
    }
  };

  const openGroupDialog = (group?: GroupCard) => {
    setEditingGroup(group || null);
    setGroupForm({ name: group?.group_name || "", gender: String(group?.gender ?? 0) });
    setGroupDialogOpen(true);
  };

  const saveGroup = async () => {
    const body = {
      tournament: TOURNAMENT_ID,
      category_name: groupForm.name || `${selectedCategory} Grup`,
      match_category: selectedCategory,
      gender: Number(groupForm.gender),
      weight_min: editingGroup?.weight_min ?? 0,
      weight_max: editingGroup?.weight_max ?? 0,
      age_min: editingGroup?.age_min ?? 0,
      age_max: editingGroup?.age_max ?? 0,
      height_min: editingGroup?.height_min ?? 0,
      height_max: editingGroup?.height_max ?? 0,
      sort_order: editingGroup?.sort_order ?? groups.length + 1,
      source: "manual",
      is_confirmed: true,
    };

    if (!editingGroup?.id) {
      const localGroup: GroupCard = {
        group_id: Date.now(),
        group_name: body.category_name,
        match_category: selectedCategory,
        gender: body.gender,
        gender_display: genderLabel(body.gender),
        sort_order: body.sort_order,
        athletes: [],
      };
      setGroups((current) => [...current, localGroup]);
      setHasUnsavedChanges(true);
      setGroupDialogOpen(false);
      return;
    }

    const res = await fetchWithAuth(`/matches/weight-classes/${editingGroup.id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Kelompok diperbarui.");
      setGroupDialogOpen(false);
      loadGroups();
    } else {
      toast.error("Gagal menyimpan kelompok.");
    }
  };

  const deleteGroup = async (group: GroupCard) => {
    if (!group.id) {
      setGroups((current) => current.filter((item) => item !== group));
      setHasUnsavedChanges(true);
      return;
    }

    const res = await fetchWithAuth(`/matches/weight-classes/${group.id}/`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Kelompok dihapus.");
      setSelectedGroupIds(prev => prev.filter(id => id !== groupKey(group)));
      loadAll();
    } else {
      toast.error("Gagal menghapus kelompok.");
    }
  };

  const openMatchDialog = (match?: MatchRow) => {
    const red = match?.participants.find((participant) => participant.corner === "red");
    const blue = match?.participants.find((participant) => participant.corner === "blue");
    setEditingMatch(match || null);
    setMatchForm({
      round: String(match?.round ?? rounds[0]?.id ?? ""),
      match_number: String(match?.match_number ?? 1),
      bout_number: String(match?.bout_number ?? ""),
      status: match?.status || "scheduled",
      red: red?.athlete ? String(red.athlete) : "",
      blue: blue?.athlete ? String(blue.athlete) : "",
      arena: match?.arena ? String(match.arena) : "",
    });
    setMatchDialogOpen(true);
  };

  const saveMatch = async () => {
    const participants = [
      ...(matchForm.red && matchForm.red !== "0" ? [{ athlete: Number(matchForm.red), corner: "red" }] : []),
      ...(matchForm.blue && matchForm.blue !== "0" ? [{ athlete: Number(matchForm.blue), corner: "blue" }] : []),
    ];

    if (!matchForm.round || participants.length === 0) {
      toast.error("Ronde dan minimal satu atlet wajib diisi.");
      return;
    }
    const body = {
      round: Number(matchForm.round),
      arena: matchForm.arena ? Number(matchForm.arena) : null,
      match_number: Number(matchForm.match_number),
      bout_number: matchForm.bout_number ? Number(matchForm.bout_number) : null,
      status: matchForm.status,
      participants_write: participants,
    };
    const endpoint = editingMatch?.id ? `/matches/${editingMatch.id}/` : "/matches/";
    const method = editingMatch?.id ? "PATCH" : "POST";
    const res = await fetchWithAuth(endpoint, { method, body: JSON.stringify(body) });
    if (res.ok) {
      toast.success("Match tersimpan.");
      setMatchDialogOpen(false);
      loadMatches();
    } else {
      toast.error("Gagal menyimpan match.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMatchIds.length === 0) return;
    if (!confirm(`Hapus ${selectedMatchIds.length} pertandingan terpilih?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`/matches/bulk-delete/?tournament=${TOURNAMENT_ID}`, {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedMatchIds }),
      });

      if (res.ok) {
        toast.success(`${selectedMatchIds.length} pertandingan dihapus.`);
        setSelectedMatchIds([]);
        // Websocket will handle the state update, but we call loadMatches for safety
        loadMatches();
      } else {
        toast.error("Gagal menghapus pertandingan.");
      }
    } catch {
      toast.error("Gagal menghubungi server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectMatch = (matchId: number) => {
    setSelectedMatchIds(prev =>
      prev.includes(matchId)
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    );
  };

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredMatches.length > 0 && filteredMatches.every(m => selectedMatchIds.includes(m.id));
    if (allFilteredSelected) {
      setSelectedMatchIds(prev => prev.filter(id => !filteredMatches.some(m => m.id === id)));
    } else {
      const newIds = Array.from(new Set([...selectedMatchIds, ...filteredMatches.map(m => m.id)]));
      setSelectedMatchIds(newIds);
    }
  };

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleSelectAllGroups = () => {
    const allFilteredSelected = filteredGroups.length > 0 && filteredGroups.every((g, idx) => selectedGroupIds.includes(groupKey(g, idx)));
    if (allFilteredSelected) {
      setSelectedGroupIds(prev => prev.filter(id => !filteredGroups.some((g, idx) => groupKey(g, idx) === id)));
    } else {
      const newIds = Array.from(new Set([...selectedGroupIds, ...filteredGroups.map((g, idx) => groupKey(g, idx))]));
      setSelectedGroupIds(newIds);
    }
  };

  const handleBulkDeleteGroups = async () => {
    if (selectedGroupIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedGroupIds.length} kelompok terpilih?`)) return;

    setIsDeletingGroups(true);
    try {
      const idsToDelete = groups
        .filter((g, idx) => selectedGroupIds.includes(groupKey(g, idx)) && g.id)
        .map(g => g.id);

      if (idsToDelete.length > 0) {
        const res = await fetchWithAuth(`/matches/weight_classes/bulk-delete/?tournament=${TOURNAMENT_ID}`, {
          method: "DELETE",
          body: JSON.stringify({ ids: idsToDelete })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          toast.error(errorData.error || "Gagal menghapus beberapa kelompok dari server.");
          setIsDeletingGroups(false);
          return;
        }
      }

      setGroups(prev => prev.filter((g, idx) => !selectedGroupIds.includes(groupKey(g, idx))));
      setSelectedGroupIds([]);
      toast.success(`${selectedGroupIds.length} kelompok berhasil dihapus`);

      await loadAll();
    } catch (error) {
      console.error("Failed to bulk delete groups:", error);
      toast.error("Gagal menghapus beberapa kelompok");
    } finally {
      setIsDeletingGroups(false);
    }
  };


  const handleResetTournamentData = async () => {
    if (!window.confirm("PERHATIAN: Ini akan menghapus SEMUA data atlet dan kelompok di tournament ini. Data yang sudah dihapus tidak bisa dikembalikan. Lanjutkan?")) return;
    if (!window.confirm("APAKAH ANDA YAKIN? Semua bracket dan jadwal akan hilang.")) return;

    setSaving(true);
    setProgressMessage("Mereset seluruh data tournament...");
    try {
      const res = await fetchWithAuth("/matchmaking/reset-tournament/", {
        method: "POST",
        body: JSON.stringify({ tournament_id: TOURNAMENT_ID })
      });

      if (res.status === 202) {
        toast.info("Reset data sedang diproses...");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal mereset data.");
      }

      toast.success("Seluruh data tournament berhasil direset.");
      setSelectedGroupIds([]);
      setGroups([]);
      setHasUnsavedChanges(false);
      await loadAll();
    } catch (error: any) {
      console.error("Reset error:", error);
      toast.error(error.message || "Gagal mereset data.");
      setProgressMessage("");
      setSaving(false);
    }
  };

  const deleteAthlete = async (athleteId: number | string) => {
    if (!window.confirm("Hapus atlet ini secara permanen dari database?")) return;

    try {
      const res = await fetchWithAuth(`/athletes/${athleteId}/`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Atlet berhasil dihapus permanen.");
        // Remove from local groups
        setGroups(prev => prev.map(g => ({
          ...g,
          athletes: g.athletes.filter(a => a.id !== Number(athleteId))
        })));
        await loadAll();
      } else {
        toast.error("Gagal menghapus atlet.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan.");
    }
  };

  const openAthleteDialog = (athlete: AthleteCard) => {
    setEditingAthlete(athlete);
    setAthleteDialogOpen(true);
  };

  const saveAthlete = async (formData: any) => {
    if (!editingAthlete?.id) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/athletes/${editingAthlete.id}/`, {
        method: "PATCH",
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Data atlet berhasil diperbarui.");
        setAthleteDialogOpen(false);
        await loadAll();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal memperbarui atlet.");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async (match: MatchRow) => {
    if (!window.confirm("Hapus pertandingan ini secara permanen?")) return;
    const res = await fetchWithAuth(`/matches/${match.id}/`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Match dihapus.");
      loadMatches();
    } else {
      toast.error("Gagal menghapus match.");
    }
  };

  const callMatchAction = async (match: MatchRow, action: "call" | "start") => {
    const res = await fetchWithAuth(`/matches/${match.id}/${action}/`, { method: "POST" });
    if (res.ok) {
      toast.success(action === "call" ? "Partai dipanggil." : "Pertandingan dimulai.");
      loadMatches();
    }
  };

  const finishMatch = async (match: MatchRow, participant: MatchParticipant) => {
    const res = await fetchWithAuth(`/matches/${match.id}/finish/`, {
      method: "POST",
      body: JSON.stringify({ winner_id: participant.athlete, winner_corner: participant.corner }),
    });
    if (res.ok) {
      toast.success("Pertandingan selesai.");
      loadMatches();
    }
  };

  const downloadWithAuth = async (endpoint: string, filename: string) => {
    if (hasUnsavedChanges && !confirm("Ada perubahan grouping yang belum disimpan. Perubahan ini mungkin tidak muncul di export PDF. Lanjutkan?")) {
      return;
    }
    const toastId = "export_progress_toast";
    toast.loading("Sedang menyiapkan file export...", { id: toastId });
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        toast.error("Export gagal. Pastikan data sudah di-grouping.", { id: toastId });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export berhasil!", { id: toastId });
    } catch (err) {
      toast.error("Terjadi kesalahan jaringan.", { id: toastId });
    }
  };

  if (authLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      {/* Global Progress Indicator (Ultra Realtime Feedback) */}
      {progressMessage && (
        <div className="fixed top-16 left-0 right-0 z-[100] animate-in slide-in-from-top-full duration-500">
          <div className="mx-auto max-w-xl px-4 py-3">
            <div className="flex items-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-2xl ring-1 ring-white/10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="flex-1 truncate">{progressMessage}</span>
              <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-1/3 animate-[progress_2s_ease-in-out_infinite] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 pb-16 pt-28 lg:px-10">
        {/* MAIN CONTENT AREA */}
        <div className="flex-1 min-w-0">

          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold tracking-tight">Athlete Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitoring statistik, kelola data atlet, dan atur bagan pertandingan.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Category)}>
                <SelectTrigger className="h-10 w-[160px] rounded-lg bg-background/70 border-foreground/10 focus:ring-0 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kyourugi">Kyourugi</SelectItem>
                  <SelectItem value="poomsae">Poomsae</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => applySort(value as SortBy)}>
                <SelectTrigger className="h-10 w-[180px] rounded-lg bg-background/70 focus:ring-0 transition-all border-foreground/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Urut grup (Default)</SelectItem>
                  <SelectItem value="age">Urut usia</SelectItem>
                  <SelectItem value="gender">Urut gender</SelectItem>
                  <SelectItem value="weight">Urut berat</SelectItem>
                  <SelectItem value="height">Urut tinggi</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-10 rounded-lg" onClick={() => setCategoryDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Group
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem onClick={() => openGroupDialog()}>
                    <Users className="mr-2 h-4 w-4" />
                    Grouping Otomatis
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGladiatorDialogOpen(true)}>
                    <Swords className="mr-2 h-4 w-4" />
                    Match Gladiator
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="h-10 rounded-lg" onClick={() => downloadWithAuth(`/matches/weight_classes/export-all-pdf/?tournament=${TOURNAMENT_ID}&category=${selectedCategory}`, `bracket-${selectedCategory}.pdf`)}>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF (Bagan)
              </Button>
              <Button variant="outline" className="h-10 rounded-lg border-destructive/20 text-destructive hover:bg-destructive/10" onClick={handleResetTournamentData} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Data
              </Button>
              <Button className="h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90" disabled={!hasUnsavedChanges || saving} onClick={handleConfirmGroups}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan
              </Button>
            </div>
          </div>

          <Tabs 
            defaultValue="groups" 
            className="space-y-6"
            onValueChange={(val) => {
              if (val === "bracket" && !hasLoadedBrackets) {
                loadGroups(false, true);
                setHasLoadedBrackets(true);
              }
            }}
          >
            <TabsList className="rounded-lg bg-background/50 border border-foreground/5 p-1">
              <TabsTrigger value="groups" className="rounded-md px-6">Grouping</TabsTrigger>
              <TabsTrigger value="bracket" className="rounded-md px-6">Bracket</TabsTrigger>
              <TabsTrigger value="athletes" className="rounded-md px-6">Data Atlet</TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="relative min-h-[500px] pb-24">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari atlet atau kelompok..."
                    className="pl-9 bg-background/50 border-foreground/10 focus:border-foreground/20 transition-all rounded-lg"
                    value={mainSearch}
                    onChange={(e) => setMainSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background/50 px-3 py-2">
                    <Checkbox
                      checked={filteredGroups.length > 0 && filteredGroups.every((g, idx) => selectedGroupIds.includes(groupKey(g, idx)))}
                      onCheckedChange={toggleSelectAllGroups}
                      id="select-all-groups"
                    />
                    <label htmlFor="select-all-groups" className="text-xs font-medium cursor-pointer">Pilih Semua</label>
                  </div>
                  {selectedGroupIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-10 rounded-lg px-4"
                      onClick={handleBulkDeleteGroups}
                      disabled={isDeletingGroups}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus ({selectedGroupIds.length})
                    </Button>
                  )}
                  <Select value={mainGenderFilter} onValueChange={setMainGenderFilter}>
                    <SelectTrigger className="h-10 w-[160px] rounded-lg bg-background/50 border-foreground/10 focus:ring-0">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Gender</SelectItem>
                      <SelectItem value="0">Putra</SelectItem>
                      <SelectItem value="1">Putri</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-10 rounded-lg text-xs" onClick={() => { setMainSearch(""); setMainGenderFilter("all"); setSelectedGroupIds([]); }}>
                    Reset
                  </Button>
                </div>
              </div>

              {(loading || isGroupsLoading) ? (
                <div className="grid gap-3 grid-cols-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-foreground/10 p-3 space-y-3 animate-pulse bg-background/50">
                      <div className="flex justify-between">
                        <div className="h-4 w-32 bg-foreground/10 rounded" />
                        <div className="h-4 w-20 bg-foreground/10 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-foreground/5 rounded" />
                        <div className="h-2 w-full bg-foreground/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredGroups.length === 0 ? (
                <Card className="rounded-lg border-foreground/10 bg-background/70">
                  <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
                    {mainSearch ? (
                      <>
                        <Search className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <h2 className="text-xl font-semibold">Tidak ada hasil ditemukan</h2>
                          <p className="text-muted-foreground">Tidak ada kelompok atau atlet yang cocok dengan "{mainSearch}"</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Users className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <h2 className="text-xl font-semibold">Belum ada grouping</h2>
                          <p className="text-muted-foreground">Pilih kategori pertandingan lalu upload CSV/XLSX untuk membuat preview.</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 grid-cols-1">
                  {filteredGroups.map((group, index) => {
                    const key = groupKey(group, index);
                    return (
                      <Card
                        key={key}
                        className="rounded-lg border-foreground/10 bg-background/70"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => draggedAthlete && moveAthlete(draggedAthlete.fromGroup, key, draggedAthlete.athleteId)}
                      >
                        <CardHeader className="p-2 pb-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <Checkbox
                                checked={selectedGroupIds.includes(key)}
                                onCheckedChange={() => toggleSelectGroup(key)}
                                className="h-3.5 w-3.5"
                              />
                              <div className="min-w-0">
                                <CardTitle className="text-[13px] font-bold truncate leading-none">{group.group_name}</CardTitle>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <GenderBadge gender={group.gender} />
                                  <Badge variant="outline" className="border-foreground/10 text-[8px] h-3.5 px-1">{group.athletes.length} atlet</Badge>
                                  <Badge variant="outline" className="border-foreground/10 text-[8px] h-3.5 px-1">{group.weight_min ?? "-"}-{group.weight_max ?? "-"} kg</Badge>
                                  <Badge variant="outline" className="border-foreground/10 text-[8px] h-3.5 px-1">{group.age_min ?? "-"}-{group.age_max ?? "-"} th</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="Export Excel" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-excel/`, `bracket-${group.group_name}.xlsx`)}>
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="Export PDF" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-pdf/`, `bracket-${group.group_name}.pdf`)}>
                                <FileText className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="Export Gambar" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-image/`, `bracket-${group.group_name}.png`)}>
                                <ImagePlus className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openGroupDialog(group)}>
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive transition-all" onClick={() => deleteGroup(group)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <div className="flex flex-col border-t border-foreground/[0.03]">
                          {(group.athletes || []).map((athlete) => (
                            <div
                              key={athleteKey(athlete)}
                              draggable
                              onDragStart={() => setDraggedAthlete({ athleteId: athleteKey(athlete), fromGroup: key })}
                              className="group/athlete flex items-center gap-2 px-2 py-1 hover:bg-primary/[0.04] transition-colors border-b border-foreground/[0.02] last:border-0"
                            >
                              <GripVertical className="h-2.5 w-2.5 shrink-0 text-muted-foreground/10 group-hover/athlete:text-muted-foreground/30 cursor-grab active:cursor-grabbing" />
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-[10px] truncate uppercase text-foreground/80">{athlete.nama}</span>
                                  <span className="text-[7px] text-primary/70 font-black px-1 border border-primary/20 rounded-[2px] bg-primary/[0.03] uppercase">{sabukText(athlete)}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center gap-2 text-[8.5px] text-muted-foreground font-medium">
                                    <span className="text-foreground/60">{athlete.umur}th</span>
                                    <span className="opacity-20">•</span>
                                    <span>{athlete.berat_kg}kg</span>
                                    <span className="opacity-20">•</span>
                                    <span>{athlete.tinggi_cm}cm</span>
                                    <span className="opacity-20">•</span>
                                    <span className="truncate max-w-[100px]">{athlete.klub || athlete.kontingen || "UMUM"}</span>
                                  </div>
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-30 group-hover/athlete:opacity-100 focus:opacity-100 transition-opacity">
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-xl border-foreground/10">
                                      <DropdownMenuItem 
                                        className="rounded-lg gap-2 cursor-pointer"
                                        onClick={() => {
                                          setMovingAthlete({ athlete, fromGroup: key });
                                          setIsMoveDialogOpen(true);
                                        }}
                                      >
                                        <MoveHorizontal className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-xs font-semibold">Pindahkan ke Kelompok</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="rounded-lg gap-2 cursor-pointer"
                                        onClick={() => editAthlete(athlete)}
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-amber-500" />
                                        <span className="text-xs font-semibold">Edit Data Atlet</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="rounded-lg gap-2 cursor-pointer text-destructive focus:text-destructive"
                                        onClick={() => removeAthlete(key, athleteKey(athlete))}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">Hapus dari Kelompok</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Group Pagination */}
              {groupTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 bg-background p-4 rounded-lg border border-foreground/5 mb-24">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setGroupPage(p => Math.max(1, p - 1))}
                    disabled={groupPage === 1}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-mono">
                    Page {groupPage} of {groupTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setGroupPage(p => Math.min(groupTotalPages, p + 1))}
                    disabled={groupPage === groupTotalPages}
                    className="rounded-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              )}

              {/* Sticky Action Bar */}
              <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-foreground/10 bg-background/90 p-2 pr-6 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 pl-4 pr-4 border-r border-foreground/10">
                  <Badge variant="secondary" className="h-6 rounded-full px-2 font-mono text-[10px]">
                    {groups.length} Groups
                  </Badge>
                  {hasUnsavedChanges && (
                    <Badge className="h-6 rounded-full bg-amber-500/20 text-amber-500 text-[10px] border-amber-500/20">
                      Unsaved
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {hasUnsavedChanges && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl px-4 text-xs font-medium text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        loadGroups();
                        setHasUnsavedChanges(false);
                        toast.info("Perubahan dibatalkan.");
                      }}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Batal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 rounded-xl px-4 text-xs font-medium hover:bg-foreground/5"
                    onClick={() => setCategoryDialogOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Re-upload
                  </Button>
                  {groups.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl px-6 text-xs font-medium border-foreground/10 hover:bg-foreground/5"
                      onClick={() => setPreviewDialogOpen(true)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-10 rounded-xl px-8 text-xs font-bold bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-foreground/10"
                    disabled={!hasUnsavedChanges || saving}
                    onClick={handleConfirmGroups}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Simpan Perubahan
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bracket" className="relative min-h-[500px] pb-24">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari kelompok..."
                    className="pl-9 bg-background/50 border-foreground/10 focus:border-foreground/20 transition-all rounded-lg"
                    value={mainSearch}
                    onChange={(e) => setMainSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {(loading || isGroupsLoading) ? (
                  [...Array(6)].map((_, i) => (
                    <Card key={i} className="rounded-lg border-foreground/10 bg-background/70 overflow-hidden animate-pulse">
                      <div className="h-40 bg-foreground/5" />
                    </Card>
                  ))
                ) : filteredGroups.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-muted-foreground">Belum ada bracket yang tersedia.</p>
                  </div>
                ) : (
                  filteredGroups.map((group, index) => {
                  const key = groupKey(group, index);
                  return (
                    <Card key={`bracket-${key}`} className="rounded-lg border-foreground/10 bg-background/70 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3 border-b border-foreground/5 bg-foreground/[0.02]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold truncate tracking-tight">{group.group_name}</CardTitle>
                            <div className="mt-1"><GenderBadge gender={group.gender} /></div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Excel" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-excel/`, `bracket-${group.group_name}.xlsx`)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="PDF" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-pdf/`, `bracket-${group.group_name}.pdf`)}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Image" onClick={() => downloadWithAuth(`/matches/weight_classes/${group.id}/export-image/`, `bracket-${group.group_name}.png`)}>
                              <ImagePlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <BracketVisual athletes={group.athletes} matches={group.matches || []} />
                      </CardContent>
                    </Card>
                  );
                })
                )}
              </div>
            </TabsContent>

            <TabsContent value="athletes" className="space-y-6">
              {/* ATHLETE DASHBOARD STATS */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card className="shadow-none border-foreground/5 bg-transparent">
                  <CardContent className="p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total Atlet</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{filteredAthleteList.length}</p>
                    <p className="text-[9px] text-muted-foreground">dari {athletes.length}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none border-foreground/5 bg-transparent">
                  <CardContent className="p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gender</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {filteredAthleteList.filter(a => a.gender === 0).length}
                      <span className="text-muted-foreground/30 font-normal mx-1">/</span>
                      {filteredAthleteList.filter(a => a.gender === 1).length}
                    </p>
                    <p className="text-[9px] text-muted-foreground">L / P</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none border-foreground/5 bg-transparent">
                  <CardContent className="p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kelas</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {filteredAthleteList.filter(a => a.class_level === '1').length}
                      <span className="text-muted-foreground/30 font-normal mx-1">/</span>
                      {filteredAthleteList.filter(a => a.class_level === '0').length}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Pr / Pe</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none border-foreground/5 bg-transparent">
                  <CardContent className="p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Klub</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{uniqueClubs.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* SEARCH & FILTERS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Filter & Pencarian</h3>
                </div>

                <Card className="border-foreground/10 bg-background/60 overflow-hidden">
                  <CardContent className="p-6 space-y-6">
                    {/* Search Row */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cari Atlet (Nama / Klub)</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Ketik nama atlet atau nama klub..."
                          className="pl-9 h-11 bg-background/50 border-foreground/10 rounded-lg focus:border-foreground/30 transition-all"
                          value={athleteSearch}
                          onChange={(e) => setAthleteSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Primary Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gender</Label>
                        <Select value={athleteGenderFilter} onValueChange={setAthleteGenderFilter}>
                          <SelectTrigger className="h-11 bg-background/50 border-foreground/10 rounded-lg focus:ring-0">
                            <SelectValue placeholder="Semua Gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Gender</SelectItem>
                            <SelectItem value="0">Putra</SelectItem>
                            <SelectItem value="1">Putri</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sabuk (Belt)</Label>
                        <Select value={athleteBeltFilter} onValueChange={setAthleteBeltFilter}>
                          <SelectTrigger className="h-11 bg-background/50 border-foreground/10 rounded-lg focus:ring-0">
                            <SelectValue placeholder="Semua Sabuk" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Sabuk</SelectItem>
                            {Object.entries(sabukLabels).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Klub / Instansi</Label>
                        <Select value={athleteClubFilter} onValueChange={setAthleteClubFilter}>
                          <SelectTrigger className="h-11 bg-background/50 border-foreground/10 rounded-lg focus:ring-0">
                            <SelectValue placeholder="Semua Klub" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Klub</SelectItem>
                            {uniqueClubs.map(club => (
                              <SelectItem key={club} value={club}>{club}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Range Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Usia (Tahun)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteAgeMin}
                            onChange={e => setAthleteAgeMin(e.target.value)}
                          />
                          <span className="text-muted-foreground text-xs font-bold">–</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteAgeMax}
                            onChange={e => setAthleteAgeMax(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Berat Badan (kg)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteWeightMin}
                            onChange={e => setAthleteWeightMin(e.target.value)}
                          />
                          <span className="text-muted-foreground text-xs font-bold">–</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteWeightMax}
                            onChange={e => setAthleteWeightMax(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tinggi Badan (cm)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteHeightMin}
                            onChange={e => setAthleteHeightMin(e.target.value)}
                          />
                          <span className="text-muted-foreground text-xs font-bold">–</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            className="h-10 bg-background/50 border-foreground/10 rounded-lg flex-1 text-sm"
                            value={athleteHeightMax}
                            onChange={e => setAthleteHeightMax(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-foreground/5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 text-xs font-bold rounded-lg border border-foreground/10 hover:bg-foreground/5"
                        onClick={() => {
                          setAthleteSearch("");
                          setAthleteGenderFilter("all");
                          setAthleteBeltFilter("all");
                          setAthleteClubFilter("all");
                          setAthleteAgeMin("");
                          setAthleteAgeMax("");
                          setAthleteWeightMin("");
                          setAthleteWeightMax("");
                          setAthleteHeightMin("");
                          setAthleteHeightMax("");
                        }}
                      >
                        <Eraser className="mr-2 h-3 w-3" />
                        Reset Filter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ATHLETE LIST TABLE */}
              <Card className="overflow-hidden border-foreground/10 bg-background/70">
                <Table>
                  <TableHeader className="bg-foreground/[0.02] border-b border-foreground/5">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Nama Atlet</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Info Fisik</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Kategori & Kelas</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Klub / Kontingen</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(loading || isAthletesLoading) ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i} className="animate-pulse">
                          <TableCell colSpan={5} className="py-8">
                            <div className="flex gap-4">
                              <div className="h-10 w-10 bg-foreground/5 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 bg-foreground/10 rounded" />
                                <div className="h-3 w-1/4 bg-foreground/5 rounded" />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredAthleteList.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 opacity-20" />
                            <p className="text-sm">Tidak ada atlet yang cocok dengan filter.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAthleteList.map((athlete) => (
                        <TableRow key={athlete.id} className="hover:bg-foreground/[0.02] transition-colors border-b border-foreground/5">
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-sm leading-tight">{athlete.nama}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  className={`text-[8px] h-5 px-2 uppercase font-bold shadow-none border-none ${
                                    athlete.gender === 0 
                                      ? "bg-blue-500 text-white" 
                                      : "bg-pink-500 text-white"
                                  }`}
                                >
                                  {athlete.gender === 0 ? "Putra" : "Putri"}
                                </Badge>
                                <Badge
                                  className="text-[8px] h-5 px-2 border border-foreground/10 bg-transparent text-muted-foreground font-bold shadow-none"
                                >
                                  {sabukLabels[normalizeSabukCode(athlete.sabuk)] || "PUTIH"}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{athlete.umur}th</span>
                                <span className="opacity-20">•</span>
                                <span>{athlete.berat_kg}kg / {athlete.tinggi_cm}cm</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                {athlete.gender === 0 ? "Laki-laki" : "Perempuan"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1.5">
                              <Badge
                                className={`w-fit text-[10px] font-bold uppercase shadow-none border-none ${athlete.class_level === '1' ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                  }`}
                              >
                                {athlete.class_level === '1' ? 'PRESTASI' : 'PEMULA'}
                              </Badge>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Belum dikelompokkan
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm text-blue-600 uppercase">{athlete.klub || "—"}</span>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{athlete.kontingen || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-lg hover:bg-foreground/5 hover:text-foreground transition-all"
                                onClick={() => openAthleteDialog(athlete)}
                                title="Edit atlet"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-lg hover:bg-foreground/5 hover:text-foreground transition-all"
                                onClick={() => athlete.id !== undefined && deleteAthlete(athlete.id)}
                                title="Hapus atlet"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pilih kategori pertandingan</DialogTitle>
            <DialogDescription>Kategori dipilih sebelum file CSV/XLSX diunggah.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["kyourugi", "poomsae"] as Category[]).map((category) => (
              <button
                key={category}
                type="button"
                className="rounded-lg border border-foreground/10 p-5 text-left transition-colors hover:bg-foreground/5"
                onClick={() => {
                  setSelectedCategory(category);
                  setCategoryDialogOpen(false);
                  setUploadDialogOpen(true);
                }}
              >
                <p className="font-semibold">{category === "kyourugi" ? "Kyourugi" : "Poomsae"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {category === "kyourugi" ? "Menggunakan model ML untuk grouping seimbang." : "Grouping manual tanpa pemaksaan model Kyourugi."}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload data atlet</DialogTitle>
            <DialogDescription>Format file: CSV, XLS, atau XLSX.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {progressMessage && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-4 text-sm text-primary animate-in fade-in slide-in-from-top-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressMessage}
              </div>
            )}
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">File atlet</Label>
            <div
              className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${isDragging
                  ? "border-foreground bg-foreground/5 scale-[1.02] shadow-2xl shadow-foreground/5"
                  : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              {file ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground/5 ring-1 ring-foreground/10">
                    <FileSpreadsheet className="h-10 w-10 text-foreground" />
                  </div>
                  <p className="max-w-[250px] truncate font-display text-lg">{file.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground tracking-tight">{(file.size / 1024).toFixed(1)} KB</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-6 rounded-full text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Lepas file
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-8">
                  <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-3xl transition-all duration-500 ${isDragging ? 'bg-foreground/10 scale-110 rotate-3 shadow-xl' : 'bg-foreground/5 shadow-inner'}`}>
                    <CloudUpload className={`h-12 w-12 transition-all duration-300 ${isDragging ? 'text-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="font-display text-xl font-medium tracking-tight">Klik atau Tarik file</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                    Letakkan berkas CSV atau Excel di sini untuk memulai pemrosesan atlet.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setUploadDialogOpen(false)}>Batal</Button>
            <Button className="rounded-lg bg-foreground text-background hover:bg-foreground/90" disabled={!file || uploading} onClick={handlePreviewUpload}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-5xl overflow-hidden rounded-xl border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-foreground/5">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-display">Preview Grouping</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  Cek, drag-and-drop, atau pindahkan atlet sebelum disimpan secara permanen.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="h-fit py-1 px-3 border-foreground/10 bg-foreground/5 font-mono text-xs">
                {groups.length} Kelompok Terdeteksi
              </Badge>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari atlet atau kelompok..."
                  className="pl-9 bg-background/50 border-foreground/10 focus:border-foreground/20 transition-all rounded-lg"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={previewGender} onValueChange={setPreviewGender}>
                  <SelectTrigger className="h-10 w-[140px] rounded-lg bg-background/50 border-foreground/10 focus:ring-0">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Gender</SelectItem>
                    <SelectItem value="0">Laki-laki</SelectItem>
                    <SelectItem value="1">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
                {selectedCategory === "poomsae" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-lg text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={clearAllGroups}
                  >
                    <Eraser className="mr-2 h-3 w-3" />
                    Kosongkan Semua
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg text-xs"
                  onClick={() => {
                    setPreviewSearch("");
                    setPreviewGender("all");
                    setPreviewClass("all");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </DialogHeader>

          {progressMessage && (
            <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg bg-primary/5 p-4 text-sm text-primary animate-in fade-in slide-in-from-top-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progressMessage}
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* Main Group List */}
            <div className={`flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-foreground/10 scrollbar-track-transparent ${selectedCategory === "poomsae" ? 'border-r border-foreground/5' : ''}`}>
              {uploading && groups.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                    <FileSpreadsheet className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Sedang memproses data...</p>
                    <p className="text-xs">{progressMessage || "Harap tunggu sebentar"}</p>
                  </div>
                </div>
              ) : groups.filter(g => {
                const matchesSearch = g.group_name.toLowerCase().includes(previewSearch.toLowerCase()) ||
                  g.athletes.some(a => a.nama.toLowerCase().includes(previewSearch.toLowerCase()));
                const matchesGender = previewGender === "all" || String(g.gender) === previewGender;
                return matchesSearch && matchesGender;
              }).length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Search className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Belum ada kelompok atau filter tidak sesuai.</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1">
                  {groups
                    .filter(g => {
                      const matchesSearch = g.group_name.toLowerCase().includes(previewSearch.toLowerCase()) ||
                        g.athletes.some(a => a.nama.toLowerCase().includes(previewSearch.toLowerCase()));
                      const matchesGender = previewGender === "all" || String(g.gender) === previewGender;
                      return matchesSearch && matchesGender;
                    })
                    .map((group, index) => {
                      const key = groupKey(group, index);
                      return (
                        <Card
                          key={key}
                          className="group overflow-hidden rounded-xl border-foreground/10 bg-background/50 transition-all hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/[0.02]"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => draggedAthlete && moveAthlete(draggedAthlete.fromGroup, key, draggedAthlete.athleteId)}
                        >
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-semibold tracking-tight">{group.group_name}</CardTitle>
                                {group.is_manual && <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">Manual</Badge>}
                              </div>
                              <GenderBadge gender={group.gender} />
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            <div className="space-y-4">
                              {/* Athletes List */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">Daftar Atlet</p>
                                {(group.athletes || []).map((athlete) => (
                                    <div
                                      key={athleteKey(athlete)}
                                      draggable
                                      onDragStart={() => setDraggedAthlete({ athleteId: athleteKey(athlete), fromGroup: key })}
                                      className="group/athlete flex items-center gap-2 px-2 py-1.5 hover:bg-primary/[0.04] transition-colors border-b border-foreground/[0.02] last:border-0"
                                    >
                                      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/10 group-hover/athlete:text-muted-foreground/30 cursor-grab active:cursor-grabbing" />
                                      <div className="flex-1 flex items-center justify-between min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-bold text-[11px] truncate uppercase text-foreground/80">{athlete.nama}</span>
                                          <span className="text-[8px] text-primary/70 font-black px-1.5 border border-primary/20 rounded-[2px] bg-primary/[0.03] uppercase">{sabukText(athlete)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium">
                                            <span className="text-foreground/60">{athlete.umur}TH</span>
                                            <span className="opacity-20">•</span>
                                            <span>{athlete.berat_kg}KG</span>
                                            <span className="opacity-20">•</span>
                                            <span>{athlete.tinggi_cm}CM</span>
                                            <span className="opacity-20">•</span>
                                            <span className="truncate max-w-[130px]">{athlete.klub || athlete.kontingen || "UMUM"}</span>
                                          </div>
                                          
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-30 group-hover/athlete:opacity-100 focus:opacity-100 transition-opacity">
                                                <MoreVertical className="h-3.5 w-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-xl border-foreground/10">
                                              <DropdownMenuItem 
                                                className="rounded-lg gap-2 cursor-pointer"
                                                onClick={() => {
                                                  setMovingAthlete({ athlete, fromGroup: key });
                                                  setIsMoveDialogOpen(true);
                                                }}
                                              >
                                                <MoveHorizontal className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="text-xs font-semibold">Pindahkan ke Kelompok</span>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem 
                                                className="rounded-lg gap-2 cursor-pointer text-destructive focus:text-destructive"
                                                onClick={() => removeAthlete(key, athleteKey(athlete))}
                                              >
                                                <X className="h-3.5 w-3.5" />
                                                <span className="text-xs font-semibold">Keluarkan dari Kelompok</span>
                                              </DropdownMenuItem>
                                              {athlete.id && (
                                                <DropdownMenuItem 
                                                  className="rounded-lg gap-2 cursor-pointer text-destructive focus:text-destructive"
                                                  onClick={() => athlete.id !== undefined && deleteAthlete(athlete.id)}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                  <span className="text-xs font-semibold">Hapus Permanen</span>
                                                </DropdownMenuItem>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    </div>
                                ))}
                              </div>


                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Poomsae Manual Sidebar */}
            {selectedCategory === "poomsae" && (
              <div className="w-[380px] flex flex-col bg-foreground/[0.01] overflow-hidden">
                <div className="p-4 border-b border-foreground/5 bg-background/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Athlete Pool
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      {poomsaePool.length} Tersisa
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search pool..."
                        className="h-8 pl-8 text-xs bg-background"
                        value={poolSearch}
                        onChange={(e) => setPoolSearch(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Select value={previewGender} onValueChange={setPreviewGender}>
                        <SelectTrigger className="h-8 text-[10px] px-2">
                          <SelectValue placeholder="G" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Gender</SelectItem>
                          <SelectItem value="0">Laki-laki</SelectItem>
                          <SelectItem value="1">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={poolSabukFilter} onValueChange={setPoolSabukFilter}>
                        <SelectTrigger className="h-8 text-[10px] px-2">
                          <SelectValue placeholder="B" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Sabuk</SelectItem>
                          {Array.from(new Set(poomsaePool.map(a => String(a.sabuk)))).sort().map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={poolAgeFilter} onValueChange={setPoolAgeFilter}>
                        <SelectTrigger className="h-8 text-[10px] px-2">
                          <SelectValue placeholder="A" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Umur</SelectItem>
                          {Array.from(new Set(poomsaePool.map(a => a.umur))).sort((a, b) => a - b).map(u => (
                            <SelectItem key={u} value={String(u)}>{u} th</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-foreground/10">
                  {poomsaePool
                    .filter(a => {
                      const matchesSearch = a.nama.toLowerCase().includes(poolSearch.toLowerCase()) ||
                        (a.klub || "").toLowerCase().includes(poolSearch.toLowerCase());
                      const matchesGender = previewGender === "all" || String(a.gender) === previewGender;
                      const matchesSabuk = poolSabukFilter === "all" || String(a.sabuk) === poolSabukFilter;
                      const matchesAge = poolAgeFilter === "all" || String(a.umur) === poolAgeFilter;
                      return matchesSearch && matchesGender && matchesSabuk && matchesAge;
                    })
                    .map((athlete) => {
                      const id = athleteKey(athlete);
                      const isSelected = selectedPoolAthletes.includes(id);
                      return (
                        <div
                          key={id}
                          onClick={() => togglePoolAthlete(id)}
                          className={`group relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                              ? 'bg-primary/10 border-primary shadow-sm'
                              : 'bg-background border-foreground/5 hover:border-foreground/20'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium truncate flex-1">{athlete.nama}</p>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary" />}
                          </div>
                          <div className="mt-1 flex items-center gap-2 opacity-70">
                            <span className="text-[9px] uppercase font-bold text-primary">{sabukText(athlete)}</span>
                            <span className="text-[9px]">{athlete.umur} th</span>
                            <span className="text-[9px] truncate">{athlete.klub || athlete.kontingen || "-"}</span>
                          </div>
                        </div>
                      );
                    })}

                  {poomsaePool.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-center p-8">
                      <UserCheck className="h-12 w-12 mb-2" />
                      <p className="text-xs">Semua atlet sudah dimasukkan ke kelompok.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-background border-t border-foreground/5">
                  <Button
                    className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
                    disabled={selectedPoolAthletes.length === 0}
                    onClick={createManualGroup}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Buat Kelompok ({selectedPoolAthletes.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex items-center justify-end gap-3 border-t border-foreground/5 bg-background/80 p-6 backdrop-blur-md">
            <Button
              variant="ghost"
              className="h-11 rounded-xl px-6 text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
              onClick={() => {
                loadGroups();
                setPreviewDialogOpen(false);
                toast.info("Perubahan dibatalkan.");
              }}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              className="h-11 rounded-lg px-8 border-foreground/10 hover:bg-foreground/5 transition-all text-sm font-medium"
              onClick={() => setPreviewDialogOpen(false)}
            >
              Lanjut edit
            </Button>
            <Button
              className="h-11 rounded-lg px-10 bg-foreground text-background hover:bg-foreground/90 transition-all text-sm font-bold"
              disabled={saving}
              onClick={handleConfirmGroups}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit kelompok" : "Buat kelompok"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama kelompok</Label>
              <Input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={groupForm.gender} onValueChange={(value) => setGroupForm((current) => ({ ...current, gender: value }))}>
                <SelectTrigger className="w-full rounded-lg focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Laki-laki</SelectItem>
                  <SelectItem value="1">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Lapangan (Arena)</Label>
              <Select value={matchForm.arena} onValueChange={(value) => setMatchForm((current) => ({ ...current, arena: value }))}>
                <SelectTrigger className="w-full rounded-lg focus:ring-0">
                  <SelectValue placeholder="Pilih lapangan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tanpa Lapangan</SelectItem>
                  {arenas.map((arena) => (
                    <SelectItem key={arena.id} value={String(arena.id)}>
                      {arena.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setGroupDialogOpen(false)}>Batal</Button>
            <Button className="rounded-lg bg-foreground text-background hover:bg-foreground/90" onClick={saveGroup}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog Pindahkan Atlet */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 bg-foreground/[0.02]">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MoveHorizontal className="h-5 w-5 text-primary" />
              Pindahkan Atlet
            </DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-wider font-semibold opacity-60">
              {movingAthlete?.athlete.nama}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 pt-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input 
                placeholder="Cari kelompok tujuan..." 
                className="pl-10 h-11 bg-foreground/[0.03] border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20"
                value={moveGroupSearch}
                onChange={(e) => setMoveGroupSearch(e.target.value)}
              />
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid gap-2">
                {groups
                  .filter(g => g.group_name.toLowerCase().includes(moveGroupSearch.toLowerCase()))
                  .map((group, idx) => {
                    const targetKey = groupKey(group, idx);
                    if (targetKey === movingAthlete?.fromGroup) return null;
                    
                    return (
                      <Button
                        key={targetKey}
                        variant="ghost"
                        className="justify-between h-12 px-4 rounded-xl hover:bg-primary/[0.05] hover:text-primary transition-all group"
                        onClick={() => {
                          if (movingAthlete) {
                            moveAthlete(movingAthlete.fromGroup, targetKey, athleteKey(movingAthlete.athlete));
                            setIsMoveDialogOpen(false);
                            setMovingAthlete(null);
                            setMoveGroupSearch("");
                          }
                        }}
                      >
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-bold text-sm truncate uppercase">{group.group_name}</span>
                          <div className="flex items-center gap-1 mt-0.5"><GenderBadge gender={group.gender} /><span className="text-[10px] opacity-50 uppercase">• {group.athletes.length} Atlet</span></div>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all text-primary" />
                      </Button>
                    );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMatch ? "Edit match" : "Buat match"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Ronde</Label>
              <Select value={matchForm.round} onValueChange={(value) => setMatchForm((current) => ({ ...current, round: value }))}>
                <SelectTrigger className="w-full rounded-lg focus:ring-0">
                  <SelectValue placeholder="Pilih ronde" />
                </SelectTrigger>
                <SelectContent>
                  {rounds.map((round) => (
                    <SelectItem key={round.id} value={String(round.id)}>
                      {round.weight_class_name} - Ronde {round.round_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nomor match</Label>
              <Input type="number" value={matchForm.match_number} onChange={(event) => setMatchForm((current) => ({ ...current, match_number: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nomor partai</Label>
              <Input type="number" value={matchForm.bout_number} onChange={(event) => setMatchForm((current) => ({ ...current, bout_number: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Merah</Label>
              <Select value={matchForm.red} onValueChange={(value) => setMatchForm((current) => ({ ...current, red: value }))}>
                <SelectTrigger className="w-full rounded-lg focus:ring-0">
                  <SelectValue placeholder="Atlet merah" />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((athlete) => (
                    <SelectItem key={athlete.id} value={String(athlete.id)}>
                      {athlete.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Biru</Label>
              <Select value={matchForm.blue} onValueChange={(value) => setMatchForm((current) => ({ ...current, blue: value }))}>
                <SelectTrigger className="w-full rounded-lg focus:ring-0">
                  <SelectValue placeholder="Atlet biru" />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((athlete) => (
                    <SelectItem key={athlete.id} value={String(athlete.id)}>
                      {athlete.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setMatchDialogOpen(false)}>Batal</Button>
            <Button className="rounded-lg bg-foreground text-background hover:bg-foreground/90" onClick={saveMatch}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={athleteDialogOpen} onOpenChange={setAthleteDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg bg-background/95 backdrop-blur-xl border-foreground/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Edit Data Atlet</DialogTitle>
            <DialogDescription>
              Perbarui informasi personal atlet untuk kejuaraan ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            saveAthlete({
              ...data,
              umur: parseInt(data.umur as string),
              gender: parseInt(data.gender as string),
              sabuk: parseInt(data.sabuk as string),
              tinggi_cm: parseFloat(data.tinggi_cm as string),
              berat_kg: parseFloat(data.berat_kg as string),
            });
          }} className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Nama Lengkap</Label>
                <Input name="nama" defaultValue={editingAthlete?.nama} className="rounded-xl bg-background/50 border-foreground/10 h-11" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Gender</Label>
                <Select name="gender" defaultValue={String(editingAthlete?.gender ?? 0)}>
                  <SelectTrigger className="h-11 rounded-xl bg-background/50 border-foreground/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Laki-laki</SelectItem>
                    <SelectItem value="1">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Sabuk</Label>
                <Select name="sabuk" defaultValue={String(editingAthlete?.sabuk ?? 0)}>
                  <SelectTrigger className="h-11 rounded-xl bg-background/50 border-foreground/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(sabukLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Umur (Tahun)</Label>
                <Input name="umur" type="number" defaultValue={editingAthlete?.umur} className="rounded-xl bg-background/50 border-foreground/10 h-11" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Kelas</Label>
                <Select name="class_level" defaultValue={editingAthlete?.class_level || '1'}>
                  <SelectTrigger className="h-11 rounded-xl bg-background/50 border-foreground/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Prestasi</SelectItem>
                    <SelectItem value="0">Pemula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Berat (Kg)</Label>
                <Input name="berat_kg" type="number" step="0.1" defaultValue={editingAthlete?.berat_kg} className="rounded-xl bg-background/50 border-foreground/10 h-11" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Tinggi (Cm)</Label>
                <Input name="tinggi_cm" type="number" step="0.1" defaultValue={editingAthlete?.tinggi_cm} className="rounded-xl bg-background/50 border-foreground/10 h-11" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Klub / Instansi</Label>
                <Input name="klub" defaultValue={editingAthlete?.klub} className="rounded-xl bg-background/50 border-foreground/10 h-11" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Kontingen</Label>
                <Input name="kontingen" defaultValue={editingAthlete?.kontingen} className="rounded-xl bg-background/50 border-foreground/10 h-11" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" className="h-12 rounded-xl px-6 border-foreground/10" onClick={() => setAthleteDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="h-12 rounded-xl px-10 bg-foreground text-background font-bold hover:bg-foreground/90" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={gladiatorDialogOpen} onOpenChange={setGladiatorDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl bg-background/95 backdrop-blur-xl border-foreground/10 shadow-2xl p-0 overflow-visible">
          <DialogHeader className="p-6 bg-primary/[0.03] border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">Match Gladiator (Ad-hoc)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Buat pertandingan manual untuk atlet yang baru daftar atau tandingan khusus.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-start relative">
              {/* VS Divider Overlay */}
              <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10">
                <div className="h-10 w-10 rounded-full bg-background border border-foreground/5 shadow-xl flex items-center justify-center font-black text-xs italic text-muted-foreground translate-y-[-12px]">VS</div>
              </div>

              {/* Red Corner */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                    />
                    Sudut Merah
                  </Label>
                  {gladiatorForm.red.id && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] font-bold px-2 py-0">Terpilih</Badge>
                  )}
                </div>
                
                <div className="space-y-3 relative">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-red-500 transition-colors" />
                    <Input 
                      placeholder="Cari atau ketik nama atlet..." 
                      className="h-12 pl-10 text-sm bg-background border-foreground/10 focus:border-red-500/50 rounded-xl transition-all shadow-sm"
                      value={redSearchQuery || gladiatorForm.red.nama}
                      onChange={(e) => {
                        setRedSearchQuery(e.target.value);
                        setGladiatorForm(prev => ({ ...prev, red: { ...prev.red, nama: e.target.value, id: null } }));
                      }}
                    />
                    
                    <AnimatePresence>
                      {filteredRedAthletes.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute top-[calc(100%+4px)] left-0 right-0 z-[100] max-h-[250px] overflow-y-auto rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-xl p-1.5 scrollbar-thin"
                        >
                          {filteredRedAthletes.map(a => (
                            <div 
                              key={a.id} 
                              className="px-3 py-2 text-sm hover:bg-red-500/5 cursor-pointer rounded-lg flex flex-col gap-0.5 transition-all group/item"
                              onClick={() => {
                                setGladiatorForm(prev => ({ 
                                  ...prev, 
                                  red: { 
                                    id: Number(a.id), 
                                    nama: a.nama, 
                                    kontingen: a.klub || a.kontingen || "UMUM" 
                                  } 
                                }));
                                setRedSearchQuery("");
                              }}
                            >
                              <span className="font-bold group-hover/item:text-red-600 transition-colors">{a.nama}</span>
                              <span className="text-[10px] text-muted-foreground">{a.klub || a.kontingen || "UMUM"}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Input 
                    placeholder="Asal Klub / Kontingen" 
                    className="h-10 text-xs bg-muted/30 border-transparent focus:bg-background focus:border-red-500/20 rounded-xl transition-all"
                    value={gladiatorForm.red.kontingen}
                    onChange={(e) => setGladiatorForm(prev => ({ ...prev, red: { ...prev.red, kontingen: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="md:col-span-1" />

              {/* Blue Corner */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2, delay: 1 }}
                      className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                    />
                    Sudut Biru
                  </Label>
                  {gladiatorForm.blue.id && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-bold px-2 py-0">Terpilih</Badge>
                  )}
                </div>
                
                <div className="space-y-3 relative">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      placeholder="Cari atau ketik nama atlet..." 
                      className="h-12 pl-10 text-sm bg-background border-foreground/10 focus:border-blue-500/50 rounded-xl transition-all shadow-sm"
                      value={blueSearchQuery || gladiatorForm.blue.nama}
                      onChange={(e) => {
                        setBlueSearchQuery(e.target.value);
                        setGladiatorForm(prev => ({ ...prev, blue: { ...prev.blue, nama: e.target.value, id: null } }));
                      }}
                    />
                    
                    <AnimatePresence>
                      {filteredBlueAthletes.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute top-[calc(100%+4px)] left-0 right-0 z-[100] max-h-[250px] overflow-y-auto rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-xl p-1.5 scrollbar-thin"
                        >
                          {filteredBlueAthletes.map(a => (
                            <div 
                              key={a.id} 
                              className="px-3 py-2 text-sm hover:bg-blue-500/5 cursor-pointer rounded-lg flex flex-col gap-0.5 transition-all group/item"
                              onClick={() => {
                                setGladiatorForm(prev => ({ 
                                  ...prev, 
                                  blue: { 
                                    id: Number(a.id), 
                                    nama: a.nama, 
                                    kontingen: a.klub || a.kontingen || "UMUM" 
                                  } 
                                }));
                                setBlueSearchQuery("");
                              }}
                            >
                              <span className="font-bold group-hover/item:text-blue-600 transition-colors">{a.nama}</span>
                              <span className="text-[10px] text-muted-foreground">{a.klub || a.kontingen || "UMUM"}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Input 
                    placeholder="Asal Klub / Kontingen" 
                    className="h-10 text-xs bg-muted/30 border-transparent focus:bg-background focus:border-blue-500/20 rounded-xl transition-all"
                    value={gladiatorForm.blue.kontingen}
                    onChange={(e) => setGladiatorForm(prev => ({ ...prev, blue: { ...prev.blue, kontingen: e.target.value } }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-foreground/5 gap-3">
            <Button 
              variant="ghost" 
              className="rounded-xl h-12 px-6" 
              onClick={() => setGladiatorDialogOpen(false)}
            >
              Batal
            </Button>
            <Button 
              className="rounded-xl h-12 px-8 flex-1 md:flex-none font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
              disabled={saving || !gladiatorForm.red.nama || !gladiatorForm.blue.nama}
              onClick={handleCreateGladiator}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Konfirmasi Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
