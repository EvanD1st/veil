import { actor, body, declareResult, handle, json } from '@/backend/veil/server';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return handle(async () => { const { id } = await context.params; const user = await actor(request, true); return json({ result: await declareResult(id, await body(request), user) }); }); }
