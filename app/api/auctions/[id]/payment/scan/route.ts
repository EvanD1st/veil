import {actor,body,handle,json} from '@/lib/veil/server';
import {queuePaymentScan} from '@/lib/veil/payment-queue';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 return handle(async()=>json(await queuePaymentScan((await params).id,await body(request,300),await actor(request,true))));
}
