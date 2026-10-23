import {request} from 'node:http';
import {Readable} from 'node:stream';
// Node's fetch does not preserve a custom Host header. Exercise the real host gate.
export function loopbackFetch(url,init={}) {
 return new Promise((resolve,reject)=>{
  const body=init.body?.toString();
  const req=request(url,{method:init.method??'GET',headers:init.headers,signal:init.signal},res=>{
   resolve(new Response([204,304].includes(res.statusCode)?null:Readable.toWeb(res),{status:res.statusCode,headers:res.headers}));
  });
  req.on('error',reject);req.end(body);
 });
}
