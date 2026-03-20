/** Unified event shape coming out of any collector */
export interface RawEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  url?: string;
  imageUrl?: string;
  source: "localist" | "campusgroups" | "sloangroups" | "gsc" | "csail" | "idss" | "medialab" | "mitsloan" | "bcs";
  sourceId?: string;
  rawData?: Record<string, unknown>;
  /** Structured hints from the source (e.g. Localist "free" flag) */
  freeFoodHint?: boolean;
}

export interface ClassifiedEvent extends RawEvent {
  hasFreeFood: boolean;
  foodConfidence: number;
  foodDetails?: string;
  topics: string[];
  fingerprint: string;
}
