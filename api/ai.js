export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = req.body || {};
    const messages = body.messages || [];
    const instructions = body.instructions || "";

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not set on server" });
    }

    let system = "Tum Pryielle AI ho. Pryielle MSG chat app ka AI dost. Hinglish mein baat karo. Short aur clear jawab do.";
    if (typeof instructions === "string" && instructions.length > 0) {
      system = system + "\n\nExtra instructions from admin:\n" + instructions.slice(0, 2000);
    }

    const contents = [];
    const recent = messages.slice(-15);
    for (let i = 0; i < recent.length; i++) {
      const m = recent[i];
      if (!m || !m.text) continue;
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.text).slice(0, 5000) }]
      });
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: "Valid messages required" });
    }

    const model = "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

    const payload = {
      systemInstruction: { parts: [{ text: system }] },
      contents: contents,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1500
      }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        error: (data && data.error && data.error.message) || "Gemini failed"
      });
    }
let text = "Kuch samajh nahi aaya, phir se try karo.";
    try {
      text = data.candidates[0].content.parts[0].text || text;
      text = text.trim();
    } catch (e) {}

    return res.status(200).json({ text: text });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
    
