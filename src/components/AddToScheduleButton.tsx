"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

interface Props {
  eventId: string;
  eventTitle: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
}

export function AddToScheduleButton({ eventId, eventTitle, startTime, endTime, location }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [conflicts, setConflicts] = useState<{ title: string; startTime: string }[]>([]);

  if (!user) return null;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving || added) return;

    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle,
          startTime,
          endTime: endTime || null,
          location: location || null,
          eventId,
          remindBefore: 30,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAdded(true);
        if (data.conflicts?.length > 0) {
          setConflicts(data.conflicts);
          setTimeout(() => setConflicts([]), 4000);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleAdd}
        disabled={saving || added}
        className={`rounded p-1 transition ${
          added
            ? "text-purple"
            : "text-cute-muted hover:text-purple hover:bg-purple-light"
        }`}
        title={added ? "Added to calendar" : "Add to calendar"}
      >
        <svg className="h-4 w-4" fill={added ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {conflicts.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md bg-yellow-50 border border-yellow-200 p-2 shadow-lg">
          <p className="text-xs font-medium text-yellow-800">Conflict:</p>
          {conflicts.map((c, i) => (
            <p key={i} className="text-xs text-yellow-700">{c.title}</p>
          ))}
        </div>
      )}
    </div>
  );
}
