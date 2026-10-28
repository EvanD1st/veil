import { QUICKNET, roundTimeMs } from '@/shared/veil/core';
export async function GET(_request: Request, context: { params: Promise<{ round: string }> }) {
  const { round } = await context.params;
  if (!/^[1-9]\d{0,8}$/.test(round)) return Response.json({ error: 'Invalid beacon round.' }, { status: 400 });
  const n = Number(round);
  if (roundTimeMs(n) > Date.now() + 10000) return Response.json({ error: 'The unlock round has not been released.' }, { status: 425, headers: { 'Cache-Control': 'no-store' } });
  for (const host of ['https://api.drand.sh', 'https://api2.drand.sh']) {
    try {
      const response = await fetch(`${host}/${QUICKNET.hash}/public/${round}`, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json() as { round: number; signature: string; randomness: string };
      if (data.round !== n || !/^[a-f0-9]{96}$/.test(data.signature)) continue;
      return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    } catch { /* Try the second fixed upstream. Clients verify the beacon signature. */ }
  }
  return Response.json({ error: 'The public time signal is not available yet. Your bid remains sealed; retry shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
