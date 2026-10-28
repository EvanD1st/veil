import { actor, handle, json, sellerEnvelopes } from '@/backend/veil/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { const { id } = await context.params; return json({ envelopes: await sellerEnvelopes(id, await actor(request)) }); }); }
