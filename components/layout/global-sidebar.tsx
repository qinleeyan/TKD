"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { fetchWithAuth } from "@/lib/api";
import { 
  Users, Trophy, Activity, MessageSquare, 
  ChevronRight, ChevronLeft, Send, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GlobalSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "chat">("stats");

  // Don't render on public pages
  if (!user || pathname === "/" || pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <div 
      className={`fixed top-0 left-0 h-screen bg-background/80 backdrop-blur-xl border-r border-foreground/10 shadow-2xl transition-all duration-500 z-40 flex flex-col ${
        isCollapsed ? "w-16" : "w-80"
      }`}
    >
      {/* Sidebar Header & Toggle */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-foreground/10 shrink-0">
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="font-display text-lg tracking-tight">Hub</span>
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Global Control</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`shrink-0 ${isCollapsed ? "mx-auto" : ""}`}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Tabs / Icons (Rail view) */}
      <div className="flex flex-col gap-2 p-2 border-b border-foreground/10 shrink-0">
        <Button
          variant={activeTab === "stats" ? "secondary" : "ghost"}
          className={`justify-start ${isCollapsed ? "px-2" : "px-4"} transition-all`}
          onClick={() => {
            setActiveTab("stats");
            if (isCollapsed) setIsCollapsed(false);
          }}
        >
          <Activity className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="ml-3 font-medium">Statistics</span>}
        </Button>
        <Button
          variant={activeTab === "chat" ? "secondary" : "ghost"}
          className={`justify-start ${isCollapsed ? "px-2" : "px-4"} transition-all`}
          onClick={() => {
            setActiveTab("chat");
            if (isCollapsed) setIsCollapsed(false);
          }}
        >
          <MessageSquare className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="ml-3 font-medium">Admin Chat</span>}
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className={`absolute inset-0 transition-opacity duration-300 ${isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          {activeTab === "stats" ? <StatsView /> : <ChatView />}
        </div>
      </div>
    </div>
  );
}

function StatsView() {
  const [stats, setStats] = useState({ athletes: 0, matches: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [athletesRes, matchesRes] = await Promise.all([
          fetchWithAuth("/athletes/"),
          fetchWithAuth("/matches/")
        ]);
        
        if (athletesRes.ok && matchesRes.ok) {
          const athletes = await athletesRes.json();
          const matchesData = await matchesRes.json();
          
          setStats({
            athletes: athletes.count || 0,
            matches: matchesData.count || 0,
            checkedIn: athletes.results?.filter((a: any) => a.is_checked_in).length || 0
          });
        }
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
    // Refresh stats every minute
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h3 className="font-display text-sm text-muted-foreground uppercase tracking-widest mb-4">Tournament Health</h3>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-background shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-display">{stats.athletes}</p>
              <p className="text-xs text-muted-foreground">Total Athletes</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-background shadow-sm">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-display">{stats.checkedIn}</p>
              <p className="text-xs text-muted-foreground">Checked In</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-background shadow-sm">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-display">{stats.matches}</p>
              <p className="text-xs text-muted-foreground">Total Matches</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChatMessage {
  id: string | number;
  user: number;
  username: string;
  role: string;
  content: string;
  created_at: string;
}

function ChatView() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetchWithAuth("/chat/messages/");
        if (res.ok) {
          const data = await res.json();
          // The API returns newest first (descending), we want to show oldest first in chat UI
          setMessages(data.reverse());
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMessages();
  }, []);

  // Set up WebSocket
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    // Use dynamic WS protocol based on current HTTP protocol
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
                 ? "localhost:8000" 
                 : window.location.host;
    
    // In many environments (like HF spaces), backend might be on a specific URL. 
    // Assuming relative proxy path if it's served together, or hardcoded for dev.
    // Assuming backend is at process.env.NEXT_PUBLIC_API_URL but replacing http with ws.
    let wsUrl = `${protocol}//${host}/ws/chat/?token=${token}`;
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    if (apiUrl.includes("http")) {
       const url = new URL(apiUrl);
       wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/chat/?token=${token}`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat_message") {
          setMessages((prev) => [...prev, data.message]);
          setTimeout(scrollToBottom, 100);
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      action: "send_message",
      content: inputMessage.trim()
    }));
    setInputMessage("");
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'superadmin': return 'text-purple-500';
      case 'register': return 'text-blue-500';
      case 'operator': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full bg-foreground/[0.02]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8 font-mono">No messages yet.</p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.username === user?.username;
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${getRoleColor(msg.role)}`}>
                    {msg.username}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${
                  isMe 
                    ? "bg-foreground text-background rounded-tr-sm" 
                    : "bg-background border border-foreground/10 shadow-sm rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-background border-t border-foreground/10 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input 
            placeholder="Type a message..." 
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="rounded-full bg-foreground/5 border-transparent focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full shrink-0"
            disabled={!inputMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
