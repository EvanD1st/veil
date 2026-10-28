import { actor, body, createAuction, handle, json, listAuctions, myAuctionIds } from '@/backend/veil/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return handle(async () => { const user = await actor(request); return json({ auctions: await listAuctions(user), mine: await myAuctionIds(user), serverTime: Date.now() }); }); }
export async function POST(request: Request) { return handle(async () => { const user = await actor(request, true); return json({ auction: await createAuction(await body(request), user) }, 201); }); }
