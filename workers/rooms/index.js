const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RESERVED = new Set(["api", "in", "assets", "proxy", "workers", "manifest", "favicon"]);
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,19}$/;
const TTL = 60 * 60 * 24; // 24 hours

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/rooms\/([a-z0-9][a-z0-9-]{0,19})$/);
    if (!match) {
      return json({ error: "Not found" }, 404);
    }

    const name = match[1];

    if (RESERVED.has(name)) {
      return json({ error: "Reserved name" }, 400);
    }

    // GET — look up a room name
    if (request.method === "GET") {
      const value = await env.ROOMS.get(name, "json");
      if (!value) {
        return json({ error: "Not found" }, 404);
      }
      return json(value);
    }

    // PUT — register a room name
    if (request.method === "PUT") {
      if (!NAME_RE.test(name)) {
        return json({ error: "Invalid name. Use lowercase letters, numbers, hyphens. 1-20 chars." }, 400);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      if (!body.roomCode) {
        return json({ error: "roomCode required" }, 400);
      }

      // Check if name is taken by a different room
      const existing = await env.ROOMS.get(name, "json");
      if (existing && existing.roomCode !== body.roomCode) {
        return json({ error: "Name already taken" }, 409);
      }

      const data = {
        roomCode: body.roomCode,
        createdAt: new Date().toISOString(),
      };

      await env.ROOMS.put(name, JSON.stringify(data), { expirationTtl: TTL });
      return json(data);
    }

    // DELETE — release a room name
    if (request.method === "DELETE") {
      await env.ROOMS.delete(name);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
