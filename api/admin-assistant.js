const SUPABASE_URL = "https://vyaxptlskssstvcibfbi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G4lJ6o6BJqH32G_D6sXIog_34IBvjKi";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function verifyPanelSession(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function getSystemPrompt(action) {
  const actionLabel = {
    chat: "responder preguntas simples",
    text: "acortar, resumir o mejorar texto"
  }[action] || "resolver tareas basicas de texto";

  return [
    "Eres un asistente interno de Pelis+ para el panel admin.",
    "Tu trabajo es ayudar con tareas basicas de texto en español, de forma clara y breve.",
    `En esta respuesta, enfocate principalmente en: ${actionLabel}.`,
    "Si el usuario comparte una descripcion larga, devuelvela lista para usar en la web.",
    "No agregues preguntas finales, sugerencias de botones, llamadas a la accion ni frases como 'quieres copiarlo' o 'quieres usarlo'.",
    "En modo texto, devuelve unicamente el resultado final limpio, sin introduccion ni cierre.",
    "No uses markdown complejo ni relleno innecesario.",
    "Responde solo con el texto util final o con una respuesta corta y directa."
  ].join(" ");
}

function buildUserPrompt(action, prompt, sourceText) {
  const parts = [
    `Accion solicitada: ${action || "chat"}.`
  ];

  if (prompt) {
    parts.push(`Instruccion del usuario:\n${prompt}`);
  }

  if (sourceText) {
    parts.push(`Texto base:\n${sourceText}`);
  }

  return parts.join("\n\n");
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(item => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim()
    }))
    .filter(item => item.content)
    .slice(-12);
}

function buildMessages(action, prompt, sourceText, history) {
  const messages = [
    {
      role: "system",
      content: getSystemPrompt(action)
    }
  ];

  messages.push(...normalizeHistory(history));
  messages.push({
    role: "user",
    content: buildUserPrompt(action, prompt, sourceText)
  });

  return messages;
}

function extractAssistantText(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(item => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, {
      ok: false,
      error: "Metodo no permitido."
    });
    return;
  }

  try {
    const token = String((req.headers.authorization || "").replace(/^Bearer\s+/i, "")).trim();

    if (!token) {
      throw new Error("Debes iniciar sesion para usar el asistente.");
    }

    const user = await verifyPanelSession(token);

    if (!user?.id) {
      throw new Error("No pude validar tu sesion del panel.");
    }

    const apiKey = String(process.env.OPENROUTER_API_KEY || process.env.PELIS_API_KEY || "").trim();

    if (!apiKey) {
      throw new Error("Falta configurar la API key del asistente en Vercel.");
    }

    const body = await readBody(req);
    const action = String(body.action || "chat").trim();
    const prompt = String(body.prompt || "").trim();
    const sourceText = String(body.sourceText || "").trim();
    const history = body.history;

    if (!prompt && !sourceText) {
      throw new Error("Debes enviar una instruccion o un texto base.");
    }

    const completionResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pelisplusoficial-sv.vercel.app",
        "X-Title": "Pelis+ Admin Assistant"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: buildMessages(action, prompt, sourceText, history)
      })
    });

    const completionData = await completionResponse.json();

    if (!completionResponse.ok) {
      throw new Error(
        completionData?.error?.message ||
        completionData?.error ||
        "OpenRouter no pudo responder en este momento."
      );
    }

    const text = extractAssistantText(completionData);

    if (!text) {
      throw new Error("La IA no devolvio una respuesta util.");
    }

    sendJson(res, 200, {
      ok: true,
      text
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || "No se pudo usar el asistente."
    });
  }
};
