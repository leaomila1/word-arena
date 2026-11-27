export { Room } from './room.js';

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const randomCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });

    const originOk = () => !env.ALLOWED_ORIGIN || env.ALLOWED_ORIGIN === '*' || request.headers.get('Origin') === env.ALLOWED_ORIGIN;
    if (request.method === 'POST' && url.pathname === '/rooms') {
      if (!originOk()) return new Response('Forbidden', { status: 403 });
      for (let i = 0; i < 10; i++) {
        const code = randomCode();
        const hostToken = crypto.randomUUID();
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, hostToken }) });
        if (r.ok) return Response.json({ code, hostToken }, { headers: cors(env) });
      }
      return Response.json({ error: 'NO_CODE' }, { status: 503, headers: cors(env) });
    }

    const m = url.pathname.match(/^\/ws\/(\d{6})$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
      if (!originOk()) return new Response('Forbidden', { status: 403 });
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(request);
    }
    return new Response('Word Arena server', { headers: cors(env) });
  },
};
