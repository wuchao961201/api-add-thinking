const http = require("http");

const PORT = Number(process.env.PORT || 8787);
const KIMI_URL = "https://api.kimi.com/coding/v1/messages";
const THINKING_BUDGET_TOKENS = Number(process.env.THINKING_BUDGET_TOKENS || 16000);

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
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    return sendJson(res, 200, { ok: true, target: KIMI_URL });
  }

  if (req.method !== "POST" || !["/v1/messages", "/messages"].includes(req.url)) {
    return sendJson(res, 404, {
      error: "Use POST /v1/messages as the Trae custom Anthropic request URL.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    return sendJson(res, 400, { error: "Invalid JSON request body." });
  }

  payload.model = payload.model || "kimi-for-coding";
  payload.thinking = {
    type: "enabled",
    budget_tokens: THINKING_BUDGET_TOKENS,
  };

  const apiKeyHeader = req.headers.authorization || req.headers["x-api-key"];
  if (!apiKeyHeader) {
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

  try {
    const upstream = await fetch(KIMI_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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
    } else {
      res.end(await upstream.text());
    }
  } catch (error) {
    sendJson(res, 502, { error: "Failed to call Kimi API.", detail: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Kimi thinking proxy listening on http://127.0.0.1:${PORT}`);
  console.log("Trae custom Anthropic request URL:");
  console.log(`http://127.0.0.1:${PORT}/v1/messages`);
  console.log("Put your Kimi API Key in Trae. The proxy only injects thinking.");
});
