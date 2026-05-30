// Naver Commerce API forward proxy.
// Run on any host with a STABLE outbound IP and register that IP in
// Naver Commerce API Center (내 애플리케이션 → 호출 가능 IP 관리).
//
// ENV:
//   PORT           - listen port (Railway sets this automatically)
//   PROXY_TOKEN    - shared secret; clients must send `Authorization: Bearer <token>`
//   ALLOW_HOSTS    - optional comma-separated allowlist of target hostnames
//                    (default: api.commerce.naver.com)

import express from "express";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.PROXY_TOKEN || "";
const ALLOW_HOSTS = (process.env.ALLOW_HOSTS || "api.commerce.naver.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.get("/health", async (_req, res) => {
  // Echo back this server's public outbound IP so the operator can register it
  // in the Naver Commerce API Center.
  let ip = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    ip = (await r.json()).ip;
  } catch {}
  res.json({ ok: true, outbound_ip: ip });
});

app.post("/forward", async (req, res) => {
  if (TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${TOKEN}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  const { url, method = "GET", headers = {}, body = null } = req.body || {};
  if (typeof url !== "string") {
    return res.status(400).json({ error: "missing url" });
  }
  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  if (!ALLOW_HOSTS.includes(target.hostname)) {
    return res.status(403).json({ error: `host not allowed: ${target.hostname}` });
  }

  try {
    const upstream = await fetch(target.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
    });
    const text = await upstream.text();
    const outHeaders = {};
    upstream.headers.forEach((v, k) => {
      outHeaders[k] = v;
    });
    res.json({ status: upstream.status, headers: outHeaders, body: text });
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`[naver-proxy] listening on :${PORT}, allow_hosts=${ALLOW_HOSTS.join(",")}`);
});
