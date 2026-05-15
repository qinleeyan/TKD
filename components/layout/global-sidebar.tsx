"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { fetchWithAuth } from "@/lib/api";
import { 
  Users, Trophy, Activity, MessageSquare, 
  ChevronRight, ChevronLeft, Send, Loader2, Trash2,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GlobalSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "chat">("stats");
  const [hasUnread, setHasUnread] = useState(false);

  // Don't render on public pages
  if (!user || pathname === "/" || pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <>
      {/* Backdrop for Mobile */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-background/40 backdrop-blur-sm z-[9998] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      {/* Floating Toggle Button when collapsed */}
      <div 
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-[10000] transition-all duration-500 ${
          isCollapsed ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-10 rounded-l-none rounded-r-xl border-y border-r border-foreground/10 bg-secondary/80 backdrop-blur-md shadow-2xl relative group overflow-visible"
          onClick={() => {
            setIsCollapsed(false);
            setHasUnread(false);
          }}
        >
          <MessageCircle className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-[10001]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-background"></span>
            </span>
          )}
        </Button>
      </div>

      {/* Sidebar Drawer */}
      <div 
        className={`fixed top-0 left-0 h-[100dvh] bg-background/95 backdrop-blur-2xl border-r border-foreground/10 shadow-2xl transition-transform duration-500 z-[9999] flex flex-col w-[85vw] sm:w-80 md:w-96 ${
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {/* Sidebar Header & Toggle */}
        <div className="h-14 sm:h-16 flex items-center justify-between px-4 shrink-0 mt-2 sm:mt-0">
          <div className="flex flex-col">
            <span className="font-display text-base sm:text-lg tracking-tight">Hub</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono uppercase tracking-widest leading-none">Global Control</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Browser-like Tabs */}
        <div className="flex px-1 sm:px-2 pt-1 sm:pt-2 border-b border-foreground/10 shrink-0 bg-foreground/5">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-t-lg transition-all ${
              activeTab === "stats" 
                ? "bg-background text-foreground shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-l border-r border-foreground/10 relative z-10" 
                : "text-muted-foreground hover:bg-foreground/5 border-transparent"
            }`}
            onClick={() => setActiveTab("stats")}
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Statistik
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-t-lg transition-all ${
              activeTab === "chat" 
                ? "bg-background text-foreground shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-l border-r border-foreground/10 relative z-10" 
                : "text-muted-foreground hover:bg-foreground/5 border-transparent"
            }`}
            onClick={() => {
                setActiveTab("chat");
                setHasUnread(false);
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Admin Chat
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative bg-background overflow-hidden">
          {activeTab === "stats" ? (
            <div className="h-full overflow-y-auto">
              <StatsView />
            </div>
          ) : (
            <ChatView isCollapsed={isCollapsed} setHasUnread={setHasUnread} setActiveTab={setActiveTab} />
          )}
        </div>
      </div>
    </>
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

function ChatView({ isCollapsed, setHasUnread, setActiveTab }: { isCollapsed: boolean, setHasUnread: (val: boolean) => void, setActiveTab: (tab: "stats" | "chat") => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audioRef.current.volume = 0.5;
  }, []);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetchWithAuth("/chat/messages/");
        if (res.ok) {
          const data = await res.json();
          // Handle paginated or non-paginated response
          const messageList = Array.isArray(data) ? data : (data.results || []);
          setMessages(messageList.reverse());
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
          
          // Play sound and show dot if sidebar is closed or message is from someone else
          if (isCollapsed || data.message.username !== user?.username) {
            if (data.message.username !== user?.username) {
              setHasUnread(true);
              audioRef.current?.play().catch(() => {});
              
              // Custom styled toast for chat (Blue theme)
              import('react-hot-toast').then(({ toast }) => {
                toast.custom((t) => (
                  <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-blue-600 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                    <div className="flex-1 w-0 p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <MessageSquare className="h-6 w-6" />
                          </div>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-bold text-white">Pesan Baru</p>
                          <p className="mt-1 text-sm text-blue-50 font-medium">
                            <span className="font-bold">{data.message.sender_name}:</span> {data.message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-l border-white/10">
                      <button
                        onClick={() => {
                          toast.dismiss(t.id);
                          setIsCollapsed(false);
                          setActiveTab("chat");
                        }}
                        className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-bold text-white hover:bg-white/10 focus:outline-none"
                      >
                        Buka
                      </button>
                    </div>
                  </div>
                ), { id: 'chat-notif', duration: 5000 });
              });
            }
          }
          
          // Remove user from typing list when message arrives
          setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(data.message.username);
            return next;
          });
        } else if (data.type === "user_typing") {
          setTypingUsers(prev => {
            const next = new Set(prev);
            if (data.is_typing) next.add(data.username);
            else next.delete(data.username);
            return next;
          });
        } else if (data.type === "chat_cleared") {
          setMessages([]);
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
    // Notify stopped typing immediately on send
    sendTypingStatus(false);
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      action: "typing",
      is_typing: isTyping
    }));
  };

  const isTypingRef = useRef(false);

  // Handle typing notification with debounce
  const handleInputChange = (val: string) => {
    setInputMessage(val);
    
    if (val.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTypingStatus(true);
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTypingStatus(false);
      }, 3000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTypingStatus(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'superadmin': return 'text-purple-500';
      case 'register': return 'text-blue-500';
      case 'operator': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat chat? Tindakan ini tidak dapat dibatalkan.")) {
      try {
        const res = await fetchWithAuth("/chat/messages/clear/", { method: "DELETE" });
        if (res.ok) {
          setMessages([]);
        } else {
          const data = await res.json();
          alert(data.error || "Gagal menghapus chat.");
        }
      } catch (err) {
        console.error("Gagal menghapus riwayat chat", err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-foreground/[0.02] overflow-hidden">
      {/* Chat Info Header */}
      <div className="bg-blue-500/10 border-b border-blue-500/20 p-2 sm:p-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-full">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-[10px] sm:text-xs font-bold text-blue-700 uppercase tracking-wide">Global Admin Group</h4>
            <p className="text-[8px] sm:text-[10px] text-blue-600/80 leading-none">Semua admin terhubung.</p>
          </div>
        </div>
        {user?.role === "superadmin" && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0" 
            onClick={handleClearHistory}
            title="Hapus Riwayat Chat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8 font-mono">No messages yet.</p>
        ) : (
          messages.map((msg, idx) => {
            // isMe logic: comparison with current user's username
            const isMe = user?.username?.toLowerCase().trim() === msg.username?.toLowerCase().trim();
            
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`flex items-center gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <span className={`text-[10px] font-bold ${isMe ? "text-primary" : getRoleColor(msg.role)}`}>
                    {isMe ? "Anda" : msg.username}
                  </span>
                  <span className="text-[9px] text-muted-foreground opacity-60">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-sm shadow-md transition-all ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/20"
                      : "bg-foreground/5 text-foreground rounded-tl-none border border-foreground/10"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Area */}
      <div className="p-4 bg-background border-t border-foreground/10 pb-[env(safe-area-inset-bottom,16px)]">
        {/* Typing Indicator with Animation */}
        {typingUsers.size > 0 && (
          <div className="px-2 pb-2 flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground italic">
              {Array.from(typingUsers).join(", ")} is typing
            </p>
            <div className="flex gap-1 items-center mb-0.5">
              <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Tulis pesan..."
            className="flex-1 px-4 py-2 bg-foreground/5 border border-foreground/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
