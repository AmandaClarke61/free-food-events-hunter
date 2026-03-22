const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const GRAPH_API = "https://graph.facebook.com/v19.0";

export async function sendWhatsAppMessage(to: string, text: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn("WhatsApp not configured, skipping message");
    return null;
  }

  const res = await fetch(`${GRAPH_API}/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("WhatsApp send error:", err);
    return null;
  }

  return res.json();
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: { type: string; text: string }[]
) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return null;

  const res = await fetch(`${GRAPH_API}/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters,
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("WhatsApp template error:", err);
    return null;
  }

  return res.json();
}
