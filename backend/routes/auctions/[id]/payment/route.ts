import {actor,body,handle,json,paymentStatus,submitPaymentReport} from '@/backend/veil/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>json(await paymentStatus((await params).id,await actor(request))));}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>json(await submitPaymentReport((await params).id,await body(request,6000),await actor(request,true))));}
