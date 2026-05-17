const http = require("http");

const PORT = Number(process.env.PORT || 8787);
const KIMI_URL = "https://api.kimi.com/coding/v1/messages";
const THINKING_BUDGET_TOKENS = Number(process.env.THINKING_BUDGET_TOKENS || 16000);
const INSECURE_TLS = process.env.KIMI_INSECURE_TLS === "1";

if (INSECURE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function log(event, details = {}) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    event,
    ...details,
  }));
}

function redactApiKey(value) {
  if (!value) return null;
  const raw = String(value).replace(/^bearer\s+/i, "");
  if (raw.length <= 10) return "[REDACTED]";
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function serializeError(error) {
  return {
    name: error?.name || null,
    message: error?.message || null,
    stack: error?.stack || null,
    cause: error?.cause ? {
      name: error.cause.name || null,
      message: error.cause.message || null,
      code: error.cause.code || null,
      errno: error.cause.errno || null,
      syscall: error.cause.syscall || null,
      hostname: error.cause.hostname || null,
    } : null,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  log("request.received", {
    method: req.method,
    url: req.url,
    accept: req.headers.accept || null,
    contentType: req.headers["content-type"] || null,
    userAgent: req.headers["user-agent"] || null,
    hasAuthorization: Boolean(req.headers.authorization),
    hasXApiKey: Boolean(req.headers["x-api-key"]),
    apiKeyPreview: redactApiKey(req.headers.authorization || req.headers["x-api-key"]),
  });

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    log("request.health", { status: 200, durationMs: Date.now() - startedAt });
    return sendJson(res, 200, { ok: true, target: KIMI_URL });
  }

  if (req.method !== "POST" || !["/v1/messages", "/messages"].includes(req.url)) {
    log("request.not_found", {
      status: 404,
      method: req.method,
      url: req.url,
      durationMs: Date.now() - startedAt,
    });
    return sendJson(res, 404, {
      error: "Use POST /v1/messages as the Trae custom Anthropic request URL.",
    });
  }

  let payload;
  try {
    const rawBody = await readBody(req);
    payload = JSON.parse(rawBody);
    log("request.body", {
      bytes: Buffer.byteLength(rawBody),
    });
  } catch (error) {
    log("request.invalid_json", {
      status: 400,
      error: error.message,
      durationMs: Date.now() - startedAt,
    });
    return sendJson(res, 400, { error: "Invalid JSON request body." });
  }

  log("request.payload", {
    model: payload.model || null,
    messageCount: Array.isArray(payload.messages) ? payload.messages.length : null,
    stream: Boolean(payload.stream),
    maxTokens: payload.max_tokens || null,
    originalThinking: payload.thinking ? {
      type: payload.thinking.type || null,
      budgetTokens: payload.thinking.budget_tokens || null,
    } : null,
  });

  if (Array.isArray(payload.messages)) {
    payload.messages.forEach((message, index) => {
      log("request.message", {
        index,
        role: message.role || null,
        content: message.content ?? null,
      });
    });
  }

  payload.model = payload.model || "kimi-for-coding";
  payload.thinking = {
    type: "enabled",
    budget_tokens: THINKING_BUDGET_TOKENS,
  };

  const apiKeyHeader = req.headers.authorization || req.headers["x-api-key"];
  if (!apiKeyHeader) {
    log("request.missing_api_key", {
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return sendJson(res, 401, {
      error: "Missing API key header. Put your Kimi API Key in Trae.",
    });
  }

  const authValue = apiKeyHeader.toLowerCase().startsWith("bearer ")
    ? apiKeyHeader
    : `Bearer ${apiKeyHeader}`;

  const headers = {
    "authorization": authValue,
    "content-type": "application/json",
    "accept": req.headers.accept || "application/json",
  };

  // Some clients send Anthropic-specific headers. They are harmless to forward.
  for (const name of ["anthropic-version", "anthropic-beta"]) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }

  log("upstream.request", {
    target: KIMI_URL,
    model: payload.model,
    stream: Boolean(payload.stream),
    thinking: payload.thinking,
    forwardedAnthropicVersion: headers["anthropic-version"] || null,
    forwardedAnthropicBeta: headers["anthropic-beta"] || null,
  });

  try {
    const upstream = await fetch(KIMI_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    log("upstream.response", {
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      durationMs: Date.now() - startedAt,
    });

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));

    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
      log("response.completed", {
        status: upstream.status,
        streamed: true,
        durationMs: Date.now() - startedAt,
      });
    } else {
      res.end(await upstream.text());
      log("response.completed", {
        status: upstream.status,
        streamed: false,
        durationMs: Date.now() - startedAt,
      });
    }
  } catch (error) {
    log("upstream.error", {
      status: 502,
      error: serializeError(error),
      durationMs: Date.now() - startedAt,
    });
    sendJson(res, 502, { error: "Failed to call Kimi API.", detail: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  log("server.started", {
    listen: `http://127.0.0.1:${PORT}`,
    messagesUrl: `http://127.0.0.1:${PORT}/v1/messages`,
    target: KIMI_URL,
    thinkingBudgetTokens: THINKING_BUDGET_TOKENS,
    insecureTls: INSECURE_TLS,
  });
});
