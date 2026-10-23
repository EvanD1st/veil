import {body,handle,json} from '@/lib/veil/server';
import {scannerAuthentication,scannerExchange} from '@/lib/veil/payment-queue';
export async function POST(request:Request){return handle(async()=>{await scannerAuthentication(request);return json(await scannerExchange(await body(request,6500)));});}
