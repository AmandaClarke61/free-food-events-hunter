/** Regex-based free food detection (Tier 1 — zero cost) */

const FREE_FOOD_PATTERNS = [
  /\bfree\s*food\b/i,
  /\bfree\s*(lunch|dinner|breakfast|pizza|snacks|drinks|coffee|tea|refreshments|meal)\b/i,
  /\b(lunch|dinner|breakfast|pizza|refreshments|snacks|meal)\s*(will be |is |are )?(provided|served|available|included|complimentary)\b/i,
  /\bcatered\b/i,
  /\bcomplimentary\s*(lunch|dinner|breakfast|food|refreshments|meal|snacks)\b/i,
  /\bfood\s*(?:and|&)\s*drinks?\s*(?:will be |are |is )?(provided|served|included)\b/i,
  /\bcome\s*(?:for|enjoy)\s*(?:free\s*)?(food|pizza|lunch|dinner|refreshments)\b/i,
  /\blight\s*refreshments\b/i,
  /\breception\s*(?:with|to follow)\b/i,
  /\bgrab\s*(?:a\s*)?(?:free\s*)?(bite|slice|food)\b/i,
];

/** Campus-specific title patterns that imply free food (e.g. "Lunch Series", "Lunch Seminar") */
const CAMPUS_FOOD_TITLE_PATTERNS = [
  /\blunch\s*(series|seminar|talk|chat|colloquium|forum|meeting|hour|discussion|lecture|workshop)\b/i,
  /\b(series|seminar|talk|colloquium|forum|meeting|discussion|lecture|workshop)\s*(?:with\s+)?lunch\b/i,
  /\b(breakfast|dinner|brunch)\s*(series|seminar|talk|colloquium|forum|meeting|discussion)\b/i,
  /\bcoffee\s*(hour|chat|social|break)\b/i,
  /\btea\s*(time|hour|social|break)\b/i,
  /\bpizza\s*(seminar|talk|night|social|session)\b/i,
  /\blunch\s*(?:&|and)\s*learn\b/i,
  /\bbrown\s*bag\s*(lunch|seminar|talk|session)\b/i,
  /\w+lunch\b/i, // compound words like "NeuroLunch"
];

const FOOD_DETAIL_PATTERNS = [
  /(?:free\s+)?(pizza|sandwiches|sushi|tacos|burritos|dim\s*sum|bagels|donuts|doughnuts|cookies|cake|ice\s*cream|BBQ|barbecue|fried\s*chicken|pasta|salad|wings|nachos|burgers)/gi,
  /(?:catered\s*(?:by|from)\s*)([^\n,.]+)/i,
];

const NEGATIVE_PATTERNS = [
  /\bfeel\s*free\b/i,
  /\bfree\s*(?:to|of\s*charge|time|space|access|software|trial|parking|admission|entry|registration)\b/i,
  /\bgluten[\s-]*free\b/i,
  /\bdairy[\s-]*free\b/i,
  /\bsugar[\s-]*free\b/i,
  /\balcohol[\s-]*free\b/i,
];

export interface RuleResult {
  hasFreeFood: boolean;
  confidence: number; // 0-1
  foodDetails?: string;
  isAmbiguous: boolean; // true = should send to LLM
}

export function detectFreeFoodByRules(
  title: string,
  description?: string
): RuleResult {
  const text = `${title} ${description ?? ""}`;

  // Check negatives first
  for (const neg of NEGATIVE_PATTERNS) {
    if (neg.test(title)) {
      // Only suppress if the negative is the only "free" mention in the title
      const withoutNeg = title.replace(neg, "");
      if (!FREE_FOOD_PATTERNS.some((p) => p.test(withoutNeg))) {
        // Check if description still has free food mentions
        if (!description || !FREE_FOOD_PATTERNS.some((p) => p.test(description))) {
          return { hasFreeFood: false, confidence: 0.8, isAmbiguous: false };
        }
      }
    }
  }

  // Check positive patterns
  let titleMatch = false;
  let descMatch = false;

  for (const pattern of FREE_FOOD_PATTERNS) {
    if (pattern.test(title)) titleMatch = true;
    if (description && pattern.test(description)) descMatch = true;
  }

  // Extract food details
  const foodItems: string[] = [];
  for (const pattern of FOOD_DETAIL_PATTERNS) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      foodItems.push(m[1] || m[0]);
    }
  }
  const foodDetails = foodItems.length > 0
    ? Array.from(new Set(foodItems)).join(", ")
    : undefined;

  if (titleMatch) {
    return { hasFreeFood: true, confidence: 0.95, foodDetails, isAmbiguous: false };
  }

  if (descMatch) {
    return { hasFreeFood: true, confidence: 0.85, foodDetails, isAmbiguous: false };
  }

  // Campus-specific title patterns (e.g. "Lunch Series" = lunch provided)
  if (CAMPUS_FOOD_TITLE_PATTERNS.some((p) => p.test(title))) {
    return { hasFreeFood: true, confidence: 0.80, foodDetails, isAmbiguous: false };
  }
  if (description && CAMPUS_FOOD_TITLE_PATTERNS.some((p) => p.test(description))) {
    return { hasFreeFood: true, confidence: 0.70, foodDetails, isAmbiguous: false };
  }

  // Medium-confidence signals: in a campus context these almost always mean free food
  const mediumSignals =
    /\b(reception|mixer|happy\s*hour|potluck|cookout|brunch)\b/i;
  const mediumInTitle = mediumSignals.test(title);
  const mediumInDesc = description ? mediumSignals.test(description) : false;

  if (mediumInTitle) {
    return { hasFreeFood: true, confidence: 0.75, foodDetails, isAmbiguous: false };
  }
  if (mediumInDesc) {
    return { hasFreeFood: true, confidence: 0.65, foodDetails, isAmbiguous: false };
  }

  // Weak signals — only mark as ambiguous for LLM if available
  const weakSignals =
    /\b(social|networking\s*event|open\s*house|celebration|ceremony)\b/i.test(text);

  if (weakSignals) {
    return { hasFreeFood: false, confidence: 0.3, isAmbiguous: true };
  }

  return { hasFreeFood: false, confidence: 0.9, isAmbiguous: false };
}
