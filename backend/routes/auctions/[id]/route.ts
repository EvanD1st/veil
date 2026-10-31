import { actor, details, handle, json } from '@/backend/veil/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { const { id } = await context.params; return json(await details(id, await actor(request))); }); }
