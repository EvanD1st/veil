import {privateJson,privateDirectory} from './private-state.mjs';
import {demoClient,seedFamily,seedCollection} from './demo-client.mjs';
import {proveDemoJob} from './proof-worker.mjs';
import {admitProof,memoryAvailable} from './admission.mjs';
import collection from './collection.json' with {type:'json'};
const [command,path,slug]=process.argv.slice(2);
try{
 const config=await privateJson(path);await privateDirectory(config.journalRoot);
 if(config.enabled!==true)throw Error('Demo worker is paused.');
 if(command==='seed'){
  const client=await demoClient(config);try{if(!slug)throw Error('Supply one exact artwork slug; no endless catalogue seeding.');await seedFamily(client,config,slug);console.log('Selected edition secured and opened/reconciled.');}finally{await client.logout();}
 }else if(command==='seed-all'){
  if(slug)throw Error('seed-all does not take an artwork slug.');const client=await demoClient(config);try{const result=await seedCollection(client,config);console.log(`Artwork auctions secured or reconciled: ${result.createdOrRecovered}; already listed: ${result.alreadyListed}.`);}finally{await client.logout();}
 }else if(command==='worker'){
  const {chromium}=await import('@playwright/test');
  // Start through run.mjs: kernel flock serializes both seed and worker commands.
  let stopping=false,browser;
  process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
  try{
   while(!stopping){try{await admitProof(config.proofAdmissionMiB??3072);}catch{console.log('Proof worker is waiting for assessed memory headroom.');for(let i=0;i<60&&!stopping;i++)await new Promise(r=>setTimeout(r,1000));continue;}const client=await demoClient(config);try{const {job}=await client.request('/api/judging/worker/claim',{});if(job){browser=await chromium.launch({headless:true,...(config.browserChannel?{channel:config.browserChannel}:{})});const guard=setInterval(()=>{memoryAvailable().then(n=>{if(n<1024**3)void browser?.close();}).catch(()=>{void browser?.close();});},1000);try{await proveDemoJob(client,config,browser,job);console.log('Demo proof verified or reconciled.');}finally{clearInterval(guard);await browser.close();browser=null;}}else if(config.recurring===true){
     // One lazy/scheduled replacement per minute; never more than one open per family or five total editions.
     const {family}=await client.request('/api/judging/worker/demand',{});if(family)try{await seedFamily(client,config,family);}catch{console.log('Edition unavailable; retained state requires review or its bounded edition budget is exhausted.');}
    }}finally{await client.logout();}for(let i=0;i<60&&!stopping;i++)await new Promise(r=>setTimeout(r,1000));}
  }finally{await browser?.close();}
}else throw Error('Use seed PRIVATE_CONFIG SLUG, seed-all PRIVATE_CONFIG, or worker PRIVATE_CONFIG.');
}catch{console.error('Demo operation stopped. Inspect the private journal; no replacement keys, bids or publication retries were manufactured.');process.exitCode=1;}
