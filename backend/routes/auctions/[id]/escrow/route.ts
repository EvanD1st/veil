import {actor,body,handle,json} from '@/backend/veil/server';
import {escrowStatus,escrowAction} from '@/backend/veil/escrow';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return handle(async()=>json(await escrowStatus((await context.params).id,await actor(request))));}
export async function POST(request:Request,context:Context){return handle(async()=>{const user=await actor(request,true);if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Same-origin request required.'},403);return json(await escrowAction((await context.params).id,await body(request,5000),user));});}
