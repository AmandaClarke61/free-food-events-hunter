/** Shared event shape returned by the API */
export interface EventDTO {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  hasFreeFood: boolean;
  foodDetails?: string | null;
  topics: string[];
  sources: string[];
  isBookmarked?: boolean;
}
