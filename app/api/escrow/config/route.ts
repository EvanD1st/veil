import {actor,handle,json} from '@/lib/veil/server';
import {escrowConfiguration} from '@/lib/veil/escrow';
export async function GET(request:Request){return handle(async()=>{await actor(request);return json(escrowConfiguration());});}
