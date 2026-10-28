import {body,handle,json} from '@/backend/veil/server';
import {scannerAuthentication,scannerExchange} from '@/backend/veil/payment-queue';
export async function POST(request:Request){return handle(async()=>{await scannerAuthentication(request);return json(await scannerExchange(await body(request,6500)));});}
