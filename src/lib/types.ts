export type School = "mit" | "harvard";

/** Source identifier — namespaced by school so cross-school dedup is safe. */
export type EventSourceName =
  // MIT
  | "localist"
  | "campusgroups"
  | "sloangroups"
  | "gsc"
  | "csail"
  | "idss"
  | "medialab"
  | "mitsloan"
  | "bcs"
  // Harvard (Localist instances)
  | "harvard-college"
  | "harvard-hbs"
  | "harvard-seas"
  // Harvard (iCal feeds)
  | "harvard-gazette"
  | "harvard-hsph"
  | "harvard-hds"
  | "harvard-hgse";

/** Unified event shape coming out of any collector */
export interface RawEvent {
  school: School;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  url?: string;
  imageUrl?: string;
  source: EventSourceName;
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
