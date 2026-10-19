import { acceptBid, actor, body, handle, json } from '@/lib/veil/server';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { const { id } = await context.params; const user = await actor(request, true); return json({ receipt: await acceptBid(id, await body(request), user) }, 201); }); }
