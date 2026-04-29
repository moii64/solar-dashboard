#!/usr/bin/env node

const API_BASE = process.env.API_BASE || 'https://solar-dashboard-xs4b.onrender.com';
const WS_URL = process.env.WS_URL || 'wss://solar-dashboard-xs4b.onrender.com/ws/inverters';

async function checkHttp() {
  const healthRes = await fetch(`${API_BASE}/healthz`);
  const healthJson = await healthRes.json().catch(() => null);

  const invertersRes = await fetch(`${API_BASE}/inverters`);
  const invertersJson = await invertersRes.json().catch(() => []);

  return {
    healthStatus: healthRes.status,
    health: healthJson,
    invertersStatus: invertersRes.status,
    invertersCount: Array.isArray(invertersJson) ? invertersJson.length : null,
  };
}

async function checkWebSocket(timeoutMs = 12000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      resolve({ ok: false, reason: 'timeout_waiting_first_message' });
    }, timeoutMs);

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      // Connected, now wait for first data event
    };

    ws.onmessage = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      let parsed = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        parsed = { raw: String(event.data).slice(0, 300) };
      }

      ws.close();
      resolve({
        ok: true,
        latencyMs: Date.now() - startedAt,
        sampleKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 8) : [],
        sample: parsed,
      });
    };

    ws.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, reason: 'ws_error', error: String(err?.message || err) });
    };

    ws.onclose = () => {
      if (settled) return;
      // close before first message
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, reason: 'closed_before_message' });
    };
  });
}

(async () => {
  const brief = process.argv.includes('--brief');

  try {
    const http = await checkHttp();
    const ws = await checkWebSocket();

    const output = {
      ok: http.healthStatus === 200 && http.invertersStatus === 200 && ws.ok,
      apiBase: API_BASE,
      wsUrl: WS_URL,
      http,
      ws,
      checkedAt: new Date().toISOString(),
    };

    if (brief) {
      const line = output.ok
        ? `OK | health:${http.healthStatus} inverters:${http.invertersStatus} ws:ok latency:${ws.latencyMs}ms count:${http.invertersCount}`
        : `FAIL | health:${http.healthStatus} inverters:${http.invertersStatus} ws:${ws.reason || 'error'}`;
      console.log(line);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }

    process.exit(output.ok ? 0 : 1);
  } catch (error) {
    if (brief) {
      console.error(`FAIL | error:${error?.message || String(error)}`);
    } else {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: error?.message || String(error),
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
    process.exit(1);
  }
})();
