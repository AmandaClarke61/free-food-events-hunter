"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  remindBefore: number;
  eventId: string | null;
  event: {
    id: string;
    title: string;
    url: string | null;
    hasFreeFood: boolean;
    foodDetails: string | null;
  } | null;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthStart(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  const fetchSchedules = useCallback(async () => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/schedule?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) fetchSchedules();
  }, [user, authLoading, router, fetchSchedules]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getMonthStart(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Group schedules by date
  const schedulesByDate: Record<string, ScheduleItem[]> = {};
  for (const s of schedules) {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!schedulesByDate[key]) schedulesByDate[key] = [];
    schedulesByDate[key].push(s);
  }

  const selectedSchedules = selectedDate ? (schedulesByDate[selectedDate] || []) : [];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600">
          &larr;
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600">
          &rarr;
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white p-2 min-h-[80px]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const daySchedules = schedulesByDate[dateStr] || [];

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`bg-white p-2 min-h-[80px] text-left transition hover:bg-blue-50 ${
                isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday
                    ? "bg-blue-600 text-white font-bold"
                    : "text-gray-700"
                }`}
              >
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {daySchedules.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className={`text-xs truncate rounded px-1 py-0.5 ${
                      s.event?.hasFreeFood
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {formatTime(s.startTime) ? `${formatTime(s.startTime)} ` : ""}
                    {s.title}
                  </div>
                ))}
                {daySchedules.length > 3 && (
                  <div className="text-xs text-gray-400">
                    +{daySchedules.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={() => { setShowCreateModal(true); setEditingItem(null); }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + Add
            </button>
          </div>

          {selectedSchedules.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No events scheduled for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedSchedules.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 truncate">{s.title}</h4>
                        {s.event?.hasFreeFood && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 flex-shrink-0">
                            Free Food
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {formatTime(s.startTime) || "All day"}
                        {s.endTime && formatTime(s.endTime) ? ` - ${formatTime(s.endTime)}` : ""}
                      </div>
                      {s.location && (
                        <div className="mt-0.5 text-sm text-gray-500">{s.location}</div>
                      )}
                      {s.description && (
                        <p className="mt-1 text-sm text-gray-600">{s.description}</p>
                      )}
                      {s.event?.url && (
                        <a
                          href={s.event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                        >
                          View event details
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingItem(s); setShowCreateModal(true); }}
                        className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ScheduleModal
          date={selectedDate!}
          item={editingItem}
          onClose={() => { setShowCreateModal(false); setEditingItem(null); }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingItem(null);
            fetchSchedules();
          }}
        />
      )}

      {loading && (
        <div className="text-center py-8 text-gray-400">Loading schedules...</div>
      )}
    </div>
  );
}

function ScheduleModal({
  date,
  item,
  onClose,
  onSaved,
}: {
  date: string;
  item: ScheduleItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [startTime, setStartTime] = useState(() => {
    if (item) {
      const d = new Date(item.startTime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "12:00";
  });
  const [endTime, setEndTime] = useState(() => {
    if (item?.endTime) {
      const d = new Date(item.endTime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "";
  });
  const [location, setLocation] = useState(item?.location || "");
  const [remindBefore, setRemindBefore] = useState(item?.remindBefore ?? 30);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<{ id: string; title: string; startTime: string }[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }

    setSaving(true);
    setError("");
    setConflicts([]);

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      startTime: startISO,
      endTime: endISO,
      location: location.trim() || null,
      remindBefore,
    };

    try {
      const url = isEdit ? `/api/schedule/${item.id}` : "/api/schedule";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      if (data.conflicts?.length > 0) {
        setConflicts(data.conflicts);
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? "Edit Schedule" : "New Schedule"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Event title"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Room or building"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Optional notes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remind Before</label>
            <select
              value={remindBefore}
              onChange={(e) => setRemindBefore(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value={0}>No reminder</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={1440}>1 day</option>
            </select>
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm font-medium text-yellow-800">Time conflict detected:</p>
              {conflicts.map((c) => (
                <p key={c.id} className="text-sm text-yellow-700 mt-1">
                  {c.title} at {formatTime(c.startTime) || "All day"}
                </p>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
