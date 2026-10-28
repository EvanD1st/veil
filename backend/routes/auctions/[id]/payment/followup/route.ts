import {actor,body,handle,json,submitPaymentFollowup} from '@/backend/veil/server';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 return handle(async()=>json(await submitPaymentFollowup((await params).id,await body(request,300),await actor(request,true))));
}
