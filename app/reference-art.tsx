'use client';
import {useEffect,useRef} from 'react';
import {paintHero,drawMidnightEditionArtwork,drawGoldenSpiralArtwork,drawHiddenIdentityArtwork} from '@/lib/veil/decorative-art.mjs';

export function ReferenceArtwork({kind,label}:{kind:string;label:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(canvas.current)(kind==='sneaker'?drawMidnightEditionArtwork:kind==='orbit'?drawGoldenSpiralArtwork:drawHiddenIdentityArtwork)(canvas.current);},[kind]);
 return <canvas ref={canvas} className="reference-artwork" width={720} height={476} role="img" aria-label={label}/>;
}

export function ReferenceHero(){
 const ref=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const node=ref.current;if(!node)return;if(canvas.current)paintHero(canvas.current);
  let frame=0,onScreen=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const pause=()=>{node.dataset.paused=String(document.hidden||!onScreen);if(document.hidden||reduced.matches||!fine.matches){node.style.setProperty('--mx','0');node.style.setProperty('--my','0');}};
  const move=(event:PointerEvent)=>{if(document.hidden||!onScreen||reduced.matches||!fine.matches||frame)return;const box=node.getBoundingClientRect();const x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;frame=requestAnimationFrame(()=>{frame=0;node.style.setProperty('--mx',String(Math.max(-.5,Math.min(.5,x))));node.style.setProperty('--my',String(Math.max(-.5,Math.min(.5,y))));});};
  const observer=new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting??false;pause();});observer.observe(node);pause();
  window.addEventListener('pointermove',move,{passive:true});document.addEventListener('visibilitychange',pause);reduced.addEventListener('change',pause);fine.addEventListener('change',pause);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',pause);reduced.removeEventListener('change',pause);fine.removeEventListener('change',pause);};
 },[]);
 return <div ref={ref} className="gold-scene reference-scene" aria-hidden="true"><canvas ref={canvas} className="reference-silk"/>{['v','v','z','z'].map((seal,i)=><div key={i} className={'reference-envelope reference-depth-'+i}><div className="reference-flight"><div className="reference-flip"><img className="reference-front" src={'/images/glass-envelope-front'+seal+'.svg'} alt=""/><img className="reference-back" src={'/images/glass-envelope-back'+(seal==='v'?'z':'v')+'.svg'} alt=""/></div></div></div>)}</div>;
}
