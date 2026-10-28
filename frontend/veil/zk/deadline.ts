// Separate bounded network/proving budgets; a stream making progress is not a stalled proof.
export function proofDeadline(expire:(message:string)=>void,override?:number,timers={set:(callback:()=>void,delay:number)=>setTimeout(callback,delay),clear:(timer:ReturnType<typeof setTimeout>)=>clearTimeout(timer)}){
 let phase='download',loaded=-1,stopped=false;
 let budget:ReturnType<typeof setTimeout>,idle:ReturnType<typeof setTimeout>|undefined;
 const fail=(message:string)=>{if(stopped)return;stop();expire(message);};
 const stop=()=>{stopped=true;timers.clear(budget);if(idle)timers.clear(idle);};
 budget=timers.set(()=>fail(override===undefined?'Proof asset download timed out. Retry to reuse verified cached parts.':'Proof generation timed out. Retry on a desktop browser.'),override??900000);
 function progress(data:{phase?:string;loaded?:number;activity?:number}){
  if(stopped||override!==undefined)return;
  if(data.phase==='prove'&&phase==='download'){
   phase='prove';timers.clear(budget);if(idle)timers.clear(idle);
   budget=timers.set(()=>fail('Proof generation timed out. Retry on a desktop browser.'),600000);
  }else if(phase==='download'&&data.phase==='download'&&Number.isFinite(data.activity??data.loaded)&&(data.activity??data.loaded)!>loaded){
   loaded=(data.activity??data.loaded)!;if(idle)timers.clear(idle);
   idle=timers.set(()=>fail('Proof asset download stalled. Retry to reuse verified cached parts.'),45000);
  }
 }
 return {progress,stop};
}
