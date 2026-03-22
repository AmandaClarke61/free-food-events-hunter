import OpenAI from "openai";
import { prisma } from "./db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_schedule",
      description: "Create a new schedule entry for the user",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the event/task" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          startTime: { type: "string", description: "Start time in HH:MM format (24h)" },
          endTime: { type: "string", description: "End time in HH:MM format (24h), optional" },
          location: { type: "string", description: "Location, optional" },
          description: { type: "string", description: "Description, optional" },
          remindBefore: { type: "number", description: "Minutes before to remind (default 30)" },
        },
        required: ["title", "date", "startTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_schedule",
      description: "List the user's schedule for a specific date or date range",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          dateTo: { type: "string", description: "End date for range query (YYYY-MM-DD), optional" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_schedule",
      description: "Delete a schedule entry by its title or ID. Use after listing to identify the item.",
      parameters: {
        type: "object",
        properties: {
          scheduleId: { type: "string", description: "ID of the schedule entry to delete" },
        },
        required: ["scheduleId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description: "Search for campus events, including free food events",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for events" },
          freeFood: { type: "boolean", description: "Only show free food events" },
          limit: { type: "number", description: "Max results (default 5)" },
        },
        required: [],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a helpful AI schedule assistant for MIT students. You help manage their personal calendar and find campus events.

Today's date is ${new Date().toISOString().split("T")[0]}.

You can:
- Create, view, and delete schedule entries
- Search for campus events (including free food events)
- Give suggestions about time management

Be concise and friendly. When creating schedules, confirm what you created. When listing, format nicely.
If the user mentions "tomorrow", "next Monday", etc., convert to actual dates.
Use 24-hour time format internally but display in 12-hour format to users.`;

interface ConversationMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

export async function processMessage(
  userId: string,
  userMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<{ reply: string; history: ConversationMessage[] }> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.map(msgToParam),
    { role: "user", content: userMessage },
  ];

  const newHistory: ConversationMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Loop for tool calls (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOLS,
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Add assistant message with tool calls
      messages.push(msg);
      newHistory.push({
        role: "assistant",
        content: msg.content || "",
      });

      // Execute each tool call
      for (const toolCall of msg.tool_calls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tc = toolCall as any;
        const args = JSON.parse(tc.function.arguments);
        const result = await executeTool(userId, tc.function.name, args);

        const toolMsg: OpenAI.Chat.Completions.ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
        messages.push(toolMsg);
        newHistory.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: tc.function.name,
        });
      }
      continue;
    }

    // No tool calls — final text response
    const reply = msg.content || "I'm not sure how to help with that.";
    newHistory.push({ role: "assistant", content: reply });
    return { reply, history: newHistory.slice(-20) }; // Keep last 20 messages
  }

  return {
    reply: "I ran into an issue processing your request. Could you try again?",
    history: newHistory.slice(-20),
  };
}

function msgToParam(
  msg: ConversationMessage
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (msg.role === "tool") {
    return {
      role: "tool",
      content: msg.content,
      tool_call_id: msg.tool_call_id || "",
    };
  }
  return { role: msg.role as "user" | "assistant", content: msg.content };
}

async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "create_schedule": {
      const { title, date, startTime, endTime, location, description, remindBefore } = args as {
        title: string; date: string; startTime: string;
        endTime?: string; location?: string; description?: string; remindBefore?: number;
      };

      const startISO = new Date(`${date}T${startTime}:00`).toISOString();
      const endISO = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;

      const schedule = await prisma.schedule.create({
        data: {
          userId,
          title,
          startTime: new Date(startISO),
          endTime: endISO ? new Date(endISO) : null,
          location: location || null,
          description: description || null,
          remindBefore: remindBefore ?? 30,
        },
      });

      return { success: true, id: schedule.id, title: schedule.title, startTime: schedule.startTime };
    }

    case "list_schedule": {
      const { date, dateTo } = args as { date: string; dateTo?: string };
      const from = new Date(`${date}T00:00:00`);
      const to = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date(`${date}T23:59:59`);

      const schedules = await prisma.schedule.findMany({
        where: {
          userId,
          startTime: { gte: from, lte: to },
        },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          location: true,
          description: true,
        },
      });

      return { schedules, count: schedules.length };
    }

    case "delete_schedule": {
      const { scheduleId } = args as { scheduleId: string };
      const existing = await prisma.schedule.findFirst({
        where: { id: scheduleId, userId },
      });
      if (!existing) return { error: "Schedule not found" };
      await prisma.schedule.delete({ where: { id: scheduleId } });
      return { success: true, deleted: existing.title };
    }

    case "search_events": {
      const { query, freeFood, limit } = args as {
        query?: string; freeFood?: boolean; limit?: number;
      };

      const where: Record<string, unknown> = {
        startTime: { gte: new Date() },
      };
      if (freeFood) where.hasFreeFood = true;

      const events = await prisma.event.findMany({
        where,
        orderBy: { startTime: "asc" },
        take: limit || 5,
      });

      // Filter by query if provided (simple search)
      const filtered = query
        ? events.filter((e) => {
            const q = query.toLowerCase();
            return (
              e.title.toLowerCase().includes(q) ||
              (e.description || "").toLowerCase().includes(q)
            );
          })
        : events;

      return {
        events: filtered.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime,
          location: e.location,
          hasFreeFood: e.hasFreeFood,
          foodDetails: e.foodDetails,
        })),
        count: filtered.length,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
