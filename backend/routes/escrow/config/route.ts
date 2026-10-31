import {actor,handle,json} from '@/backend/veil/server';
import {escrowConfiguration} from '@/backend/veil/escrow';
export async function GET(request:Request){return handle(async()=>{await actor(request);return json(escrowConfiguration());});}
