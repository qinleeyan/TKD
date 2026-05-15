"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WS_BASE_URL, getAuthToken } from "@/lib/api";

// 🛡️ INTERNAL TAB DEDUPLICATION
// Persists across re-renders/mounts in the same tab/window
const globalEventCache: Record<string, number> = {};

export function useRealtime(tournamentId: number | string, onEvent: (event: string, data: any) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const onEventRef = useRef(onEvent);
  
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const token = getAuthToken();
    const wsUrl = `${WS_BASE_URL}/tournament/${tournamentId}/${token ? `?token=${token}` : ""}`;
    
    console.log("📡 Connecting to WebSocket...");
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ WebSocket Connected");
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // 🛡️ DEDUPLICATION LOGIC
        // Normalize payload: handle both 'tournament_event' wrapper and direct messages
        const evType = payload.event || (payload.type === 'tournament_event' ? null : payload.type);
        const data = payload.data || payload;
        const actualEvent = evType || payload.event;
        
        if (!actualEvent) return;

        const msgId = payload.msg_id || data.msg_id || null;
        const entityId = data.id || data.athlete_id || data.match_id || 'global';
        
        // Key is unique per event-entity OR message UUID
        const cacheKey = msgId ? `msg-${msgId}` : `${actualEvent}-${entityId}`;
        const now = Date.now();
        
        // If same message arrives within 2 seconds in THIS tab, drop it
        if (globalEventCache[cacheKey] && (now - globalEventCache[cacheKey] < 2000)) {
          console.log(`🚫 Dropping duplicate event (Local Tab): ${cacheKey}`);
          return;
        }
        
        globalEventCache[cacheKey] = now;
        onEventRef.current(actualEvent, data);
      } catch (err) {
        console.error("❌ WS Message Error:", err);
      }
    };
    

    ws.onclose = () => {
      console.log("⚠️ WebSocket Disconnected");
      setIsConnected(false);
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 5000);
        setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket Error:", err);
      ws.close();
    };

    socketRef.current = ws;
  }, [tournamentId]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, [connect]);

  const broadcast = useCallback((event: string, data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: 'broadcast',
        event,
        data
      }));
    } else {
      console.warn("⚠️ Cannot broadcast: WebSocket not connected");
    }
  }, []);

  return { isConnected, broadcast };
}
