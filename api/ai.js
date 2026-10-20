export default async function handler(req, res) {
  // CORS
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
    const { messages = [], instructions = "" } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not set on server" });
    }

    // System prompt
    let system = `Tum 'Pryielle AI' ho. Pryielle MSG chat app ka AI dost. Hinglish mein baat karo. Short aur clear jawab do.`;
    if (instructions && typeof instructions === "string") {
      system += `\n\nExtra instructions from admin:\n${instructions.slice(0, 2000)}`;
    }

    // Gemini format
    const contents = [];
    for (const m of messages.slice(-15)) {
      if (!m || !m.text) continue;
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.text).slice(0, 5000) }],
      });
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: "Valid messages required" });
    }

    const model = "gemini-2.0-flash"; // ya gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/\( {model}:generateContent?key= \){apiKey}`;

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1500,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("Gemini error", data);
      return res.status(500).json({
        error: data?.error?.message || "Gemini failed",
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Kuch samajh nahi aaya, phir se try karo.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
