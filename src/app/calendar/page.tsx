import { CalendarClient } from "./CalendarClient";

export const metadata = {
  title: "My Calendar - MIT Events",
};

export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My Calendar</h1>
      <CalendarClient />
    </div>
  );
}
