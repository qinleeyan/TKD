"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

interface Athlete {
  id?: string;
  nama: string;
  klub?: string;
}

interface Match {
  id?: string;
  match_id?: string;
  nomor_partai?: number;
  bout_number?: number;
  athlete_a?: any;
  athlete_b?: any;
  babak?: string;
  is_final?: boolean;
}

interface BracketVisualProps {
  athletes: Athlete[];
  matches: Match[];
}

export function BracketVisual({ athletes, matches }: BracketVisualProps) {
  const n = athletes.length;

  if (n < 2) return <div className="text-center p-4 text-xs text-muted-foreground italic">Atlet tidak cukup untuk bagan</div>;

  const renderAthlete = (athlete: any, side: 'blue' | 'red') => {
    const isPlaceholder = athlete?.is_placeholder;
    const name = isPlaceholder ? (athlete.display_name || "Pemenang") : athlete?.nama || "BYE";
    const colorClass = side === 'blue' ? "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300" : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300";

    return (
      <div className={`relative flex items-center gap-2 p-1.5 rounded border ${colorClass} min-w-0`}>
        <div className={`h-full w-1 absolute left-0 top-0 rounded-l ${side === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
        <p className="truncate text-[10px] font-bold pl-1 uppercase tracking-tight">{name}</p>
      </div>
    );
  };

  const renderMatchNumber = (match?: Match) => {
    const num = match?.bout_number || match?.nomor_partai;
    return (
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-foreground/20 rounded h-5 px-1.5 flex items-center justify-center z-10">
        <span className="text-[9px] font-black italic">{num ? `Partai ${num}` : "P"}</span>
      </div>
    );
  };

  return (
    <div className="relative p-2 bg-foreground/[0.02] rounded-xl border border-foreground/5 overflow-hidden">
      {/* Visual representation based on n */}
      {n === 2 && (
        <div className="flex flex-col gap-8 py-4">
          <div className="relative flex items-center">
            <div className="flex-1">{renderAthlete(athletes[0], 'blue')}</div>
            <div className="w-8 h-[2px] bg-foreground/20" />
            <div className="w-[2px] h-[50px] bg-foreground/20 absolute right-0 top-[calc(50%+1px)]" />
          </div>
          <div className="relative flex items-center">
            <div className="flex-1">{renderAthlete(athletes[1], 'red')}</div>
            <div className="w-8 h-[2px] bg-foreground/20" />
            <div className="w-[2px] h-[50px] bg-foreground/20 absolute right-0 bottom-[calc(50%+1px)]" />
          </div>
          {renderMatchNumber(matches[0])}
        </div>
      )}

      {n === 3 && (
        <div className="flex flex-col gap-6 py-2">
          {/* BYE Slot */}
          <div className="flex items-center">
            <div className="w-1/2">{renderAthlete(athletes[0], 'blue')}</div>
            <div className="w-[calc(50%+16px)] h-[2px] bg-foreground/20" />
            <div className="w-[2px] h-[60px] bg-foreground/20" />
          </div>
          {/* SF Slot */}
          <div className="relative flex flex-col gap-4 pl-[20%]">
             <div className="flex items-center">
               <div className="flex-1">{renderAthlete(athletes[1], 'blue')}</div>
               <div className="w-4 h-[2px] bg-foreground/20" />
             </div>
             <div className="flex items-center">
               <div className="flex-1">{renderAthlete(athletes[2], 'red')}</div>
               <div className="w-4 h-[2px] bg-foreground/20" />
             </div>
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-full bg-foreground/20" />
             <div className="absolute -right-4 top-1/2 w-4 h-[2px] bg-foreground/20" />
             {renderMatchNumber(matches.find(m => !m.is_final && m.match_number !== undefined ? m.match_number === 1 : m !== matches[matches.length-1]))}
          </div>
          {/* Final Connection */}
          <div className="absolute right-0 top-[calc(50%-1px)] w-4 h-[2px] bg-foreground/20" />
          <div className="absolute right-[-16px] top-1/2 -translate-y-1/2">
             {renderMatchNumber(matches.find(m => m.is_final || m === matches[matches.length-1]))}
          </div>
        </div>
      )}

      {n === 4 && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-4">
           {/* Top SF */}
           <div className="relative flex flex-col gap-4">
              {renderAthlete(athletes[0], 'blue')}
              {renderAthlete(athletes[1], 'red')}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-foreground/20" />
              <div className="absolute -right-4 top-1/4 h-1/2 w-[2px] bg-foreground/20" />
              {renderMatchNumber(matches[0])}
           </div>
           {/* Bottom SF */}
           <div className="relative flex flex-col gap-4">
              {renderAthlete(athletes[2], 'blue')}
              {renderAthlete(athletes[3], 'red')}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-foreground/20" />
              <div className="absolute -right-4 top-1/4 h-1/2 w-[2px] bg-foreground/20" />
              {renderMatchNumber(matches[1])}
           </div>
           {/* Final Link */}
           <div className="col-span-2 relative h-4 mt-[-20px]">
              <div className="absolute left-[calc(25%+16px)] right-[calc(25%+16px)] top-0 h-[60px] border-r-2 border-l-2 border-t-2 border-foreground/20 rounded-t-lg" />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 h-10 w-[2px] bg-foreground/20 mt-[-40px]" />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 mt-[-60px]">
                {renderMatchNumber(matches.find(m => m.is_final || m === matches[matches.length-1]))}
              </div>
           </div>
        </div>
      )}

      {n > 4 && (
        <div className="text-center p-4 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
           Visual Bagan {n} Atlet (List View)
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-foreground/5 pt-2">
         <Badge variant="outline" className="text-[8px] h-4 border-foreground/10 px-1.5 opacity-50 uppercase tracking-tighter">
            Bracket Generation v2.0
         </Badge>
         <div className="flex gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
         </div>
      </div>
    </div>
  );
}
