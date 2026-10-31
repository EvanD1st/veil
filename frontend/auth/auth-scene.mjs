import{paintAuthBackdrop}from'./auth-backdrop.mjs';
/* Adapted from the operator-supplied VEIL design. Decorative only; authentication stays server-side. */
export{sceneStyles}from'./auth-styles.mjs';
export const sceneMarkup=`<canvas id="authScenery" class="auth-backdrop" aria-hidden="true"></canvas><div id="svgSceneLayer" class="auth-scene" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice"><defs>
        <!-- Depth of Field Blur Filters -->
        <filter id="dof-far" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.8" />
        </filter>
        <filter id="dof-mid" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id="dof-top-right" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="dof-foreground" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <filter id="seal-shadow" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="2" dy="7" stdDeviation="5" flood-color="#3a2504" flood-opacity="0.45" />
        </filter>

        <!-- Frosted Champagne Crystal Gradients -->
        <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.82" />
          <stop offset="28%" stop-color="#fdf6e7" stop-opacity="0.62" />
          <stop offset="65%" stop-color="#ecd8ad" stop-opacity="0.46" />
          <stop offset="100%" stop-color="#fffdf8" stop-opacity="0.76" />
        </linearGradient>

        <linearGradient id="glassFlapTop" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.90" />
          <stop offset="52%" stop-color="#faefd9" stop-opacity="0.62" />
          <stop offset="100%" stop-color="#e5ca90" stop-opacity="0.42" />
        </linearGradient>

        <linearGradient id="glassFlapBottom" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#fffdf8" stop-opacity="0.74" />
          <stop offset="100%" stop-color="#e6cc96" stop-opacity="0.48" />
        </linearGradient>

        <!-- Luminous 24K Gold Seam & Rim Gradient -->
        <linearGradient id="goldEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff9e2" stop-opacity="1" />
          <stop offset="26%" stop-color="#f3cb62" stop-opacity="0.96" />
          <stop offset="55%" stop-color="#b8821c" stop-opacity="0.90" />
          <stop offset="80%" stop-color="#f8d878" stop-opacity="0.96" />
          <stop offset="100%" stop-color="#fff6cc" stop-opacity="1" />
        </linearGradient>

        <!-- Burnished 24K Gold Wax Seal Gradients -->
        <radialGradient id="waxSealOuter" cx="32%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#fff5bf" />
          <stop offset="26%" stop-color="#f0c44e" />
          <stop offset="60%" stop-color="#b87e17" />
          <stop offset="86%" stop-color="#7c4f06" />
          <stop offset="100%" stop-color="#d8a22b" />
        </radialGradient>

        <radialGradient id="waxSealInner" cx="62%" cy="68%" r="68%">
          <stop offset="0%" stop-color="#8b5908" />
          <stop offset="45%" stop-color="#c68d1f" />
          <stop offset="82%" stop-color="#ebbf4b" />
          <stop offset="100%" stop-color="#fff1b0" />
        </radialGradient>

        <!-- ===============================================================
             SEAL 1: 24K GOLD 'V' (VEIL) WAX SEAL
             =============================================================== -->
        <g id="veilSealV">
          <circle cx="0" cy="0" r="37" fill="url(#waxSealOuter)" stroke="url(#goldEdgeGrad)" stroke-width="1.8" filter="url(#seal-shadow)" />
          <circle cx="0" cy="0" r="31" fill="none" stroke="#6b4204" stroke-width="1.3" stroke-opacity="0.72" />
          <circle cx="0" cy="0" r="28" fill="url(#waxSealInner)" stroke="url(#goldEdgeGrad)" stroke-width="1.4" />
          <!-- Specular metallic sheen arcs -->
          <path d="M -22 -17 A 27 27 0 0 1 20 -19" fill="none" stroke="rgba(255,252,232,0.72)" stroke-width="2.2" stroke-linecap="round" />
          <path d="M -19 20 A 27 27 0 0 0 22 15" fill="none" stroke="rgba(255,236,165,0.48)" stroke-width="1.6" stroke-linecap="round" />
          <!-- Embossed Golden Serif 'V' -->
          <g transform="translate(0, 2)">
            <line x1="-14" y1="-13.5" x2="-6.5" y2="-13.5" stroke="#fff7d1" stroke-width="2.2" stroke-linecap="round" />
            <line x1="6.5" y1="-13.5" x2="14" y2="-13.5" stroke="#fff7d1" stroke-width="2.2" stroke-linecap="round" />
            <path d="M -11.2 -13.5 L -0.5 13 L 1.6 13 L -8.2 -13.5 Z" fill="#fff7d1" stroke="#7c4f06" stroke-width="0.5" />
            <line x1="10.6" y1="-13.5" x2="0.6" y2="13" stroke="#fff7d1" stroke-width="2.1" stroke-linecap="round" />
          </g>
        </g>

        <!-- ===============================================================
             SEAL 2: 24K GOLD 'Z' (ZCASH 'Ƶ') WAX SEAL
             =============================================================== -->
        <g id="veilSealZ">
          <circle cx="0" cy="0" r="37" fill="url(#waxSealOuter)" stroke="url(#goldEdgeGrad)" stroke-width="1.8" filter="url(#seal-shadow)" />
          <circle cx="0" cy="0" r="31" fill="none" stroke="#6b4204" stroke-width="1.3" stroke-opacity="0.75" />
          <circle cx="0" cy="0" r="28" fill="url(#waxSealInner)" stroke="url(#goldEdgeGrad)" stroke-width="1.4" />
          <!-- Specular metallic sheen arcs -->
          <path d="M -22 -17 A 27 27 0 0 1 20 -19" fill="none" stroke="rgba(255,252,232,0.75)" stroke-width="2.2" stroke-linecap="round" />
          <path d="M -19 20 A 27 27 0 0 0 22 15" fill="none" stroke="rgba(255,236,165,0.5)" stroke-width="1.6" stroke-linecap="round" />
          <!-- Embossed Zcash 'Z' with vertical currency bar -->
          <g transform="translate(0, 0)">
            <!-- Shadow for 3D relief -->
            <g transform="translate(0.8, 1.2)" opacity="0.55">
              <line x1="0" y1="-17.5" x2="0" y2="17.5" stroke="#4f3002" stroke-width="3.4" stroke-linecap="round" />
              <path d="M -11 -11.5 L 11 -11.5 L -11 11.5 L 11 11.5" fill="none" stroke="#4f3002" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <!-- Vertical strike-through bar (top & bottom caps) -->
            <line x1="0" y1="-17.5" x2="0" y2="-11.5" stroke="#fff6cc" stroke-width="3.2" stroke-linecap="round" />
            <line x1="0" y1="11.5" x2="0" y2="17.5" stroke="#fff6cc" stroke-width="3.2" stroke-linecap="round" />
            <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke="#f5d169" stroke-width="2.6" stroke-linecap="round" />
            <!-- Bold Embossed Z -->
            <path d="M -11 -11.5 L 11 -11.5 L -11 11.5 L 11 11.5" fill="none" stroke="#fff7d4" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Inner bevel highlight -->
            <path d="M -10 -11.5 L 10 -11.5 L -10 11.5 L 10 11.5" fill="none" stroke="#c88d19" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round" />
          </g>
        </g>

        <!-- ===============================================================
             BASE ENVELOPE FRONT GEOMETRY (Without Seal, so V or Z attaches)
             =============================================================== -->
        <g id="envelopeBodyFront">
          <!-- Soft warm ambient drop shadow -->
          <rect x="-160" y="-105" width="320" height="210" rx="12" fill="rgba(82, 54, 12, 0.15)" transform="translate(3, 12)" />
          <!-- Main frosted champagne crystal body -->
          <rect x="-160" y="-105" width="320" height="210" rx="11" fill="url(#glassBodyGrad)" stroke="url(#goldEdgeGrad)" stroke-width="2.6" />
          <!-- Subtle inner crystalline rim highlight -->
          <rect x="-153" y="-98" width="306" height="196" rx="8" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.82" />
          <!-- Left & Right crystal folds -->
          <path d="M -157 -101 L 0 8 L -157 101 Z" fill="rgba(255,253,245,0.28)" stroke="url(#goldEdgeGrad)" stroke-width="1.5" />
          <path d="M 157 -101 L 0 8 L 157 101 Z" fill="rgba(242,222,178,0.25)" stroke="url(#goldEdgeGrad)" stroke-width="1.5" />
          <!-- Bottom Flap -->
          <path d="M -157 102 L -12 -8 Q 0 -17 12 -8 L 157 102 Z" fill="url(#glassFlapBottom)" stroke="url(#goldEdgeGrad)" stroke-width="1.9" />
          <!-- Top Sealing Flap -->
          <path d="M -157 -102 L -10 12 Q 0 21 10 12 L 157 -102 Z" fill="url(#glassFlapTop)" stroke="url(#goldEdgeGrad)" stroke-width="2.2" />
          <!-- Specular crystalline edge streaks -->
          <line x1="-145" y1="-103" x2="125" y2="-103" stroke="#ffffff" stroke-width="2.8" stroke-opacity="0.94" stroke-linecap="round" />
          <line x1="-159" y1="-88" x2="-159" y2="85" stroke="#fff9e2" stroke-width="2.4" stroke-opacity="0.88" stroke-linecap="round" />
        </g>

        <!-- ===============================================================
             BASE ENVELOPE BACK GEOMETRY (Zero-Knowledge Proof Cipher Card)
             =============================================================== -->
        <g id="envelopeBodyBack">
          <rect x="-160" y="-105" width="320" height="210" rx="12" fill="rgba(82, 54, 12, 0.18)" transform="translate(-3, 12)" />
          <rect x="-160" y="-105" width="320" height="210" rx="11" fill="url(#glassBodyGrad)" stroke="url(#goldEdgeGrad)" stroke-width="2.6" />
          <rect x="-148" y="-93" width="296" height="186" rx="6" fill="rgba(255, 251, 240, 0.34)" stroke="url(#goldEdgeGrad)" stroke-width="1.3" stroke-opacity="0.9" />
          <rect x="-140" y="-85" width="280" height="170" rx="4" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1" stroke-dasharray="6 4" />
          <!-- Refracted X-seams visible through the frosted crystal -->
          <line x1="-148" y1="-93" x2="148" y2="93" stroke="url(#goldEdgeGrad)" stroke-width="0.9" stroke-opacity="0.4" />
          <line x1="148" y1="-93" x2="-148" y2="93" stroke="url(#goldEdgeGrad)" stroke-width="0.9" stroke-opacity="0.4" />
          <!-- Sealed Bid Document Card inside -->
          <rect x="-112" y="-64" width="224" height="128" rx="4" fill="rgba(255, 253, 247, 0.52)" stroke="url(#goldEdgeGrad)" stroke-width="1.2" />
          <!-- Zero-Knowledge Proof Sacred Geometry Rings -->
          <circle cx="0" cy="0" r="48" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="1.4" stroke-opacity="0.9" />
          <circle cx="0" cy="0" r="40" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="1.0" stroke-dasharray="3 3" stroke-opacity="0.8" />
          <!-- Cipher inscription lines -->
          <line x1="-94" y1="-42" x2="-52" y2="-42" stroke="url(#goldEdgeGrad)" stroke-width="1.8" stroke-linecap="round" />
          <line x1="-94" y1="-32" x2="-64" y2="-32" stroke="url(#goldEdgeGrad)" stroke-width="1.2" stroke-opacity="0.75" stroke-linecap="round" />
          <line x1="52" y1="-42" x2="94" y2="-42" stroke="url(#goldEdgeGrad)" stroke-width="1.8" stroke-linecap="round" />
          <line x1="64" y1="-32" x2="94" y2="-32" stroke="url(#goldEdgeGrad)" stroke-width="1.2" stroke-opacity="0.75" stroke-linecap="round" />
          <line x1="-88" y1="46" x2="88" y2="46" stroke="url(#goldEdgeGrad)" stroke-width="1.3" stroke-opacity="0.8" stroke-linecap="round" />
        </g>

        <!-- ===============================================================
             COMPLETE 3D ENVELOPE VARIANTS WITH 'V' AND 'Z' SEALS
             =============================================================== -->
        <g id="glassEnvelopeFrontZ">
          <use href="#envelopeBodyFront" />
          <use href="#veilSealZ" x="0" y="2" />
        </g>
        <g id="glassEnvelopeFrontV">
          <use href="#envelopeBodyFront" />
          <use href="#veilSealV" x="0" y="2" />
        </g>
        <g id="glassEnvelopeBackV">
          <use href="#envelopeBodyBack" />
          <g transform="scale(0.96)">
            <use href="#veilSealV" x="0" y="0" />
          </g>
        </g>
        <g id="glassEnvelopeBackZ">
          <use href="#envelopeBodyBack" />
          <g transform="scale(0.96)">
            <use href="#veilSealZ" x="0" y="0" />
          </g>
        </g>
      </defs><g id="interactiveEnvelopesLayer"></g></svg></div><a class="auth-brand" href="/">VEIL<span class="testnet">TESTNET</span></a><aside class="auth-story"><p class="eyebrow">Private auctions</p><h2>Your bid.<br> Your secret.</h2><p>Sealed until the moment that matters.</p></aside>`;
export const sceneScript=`(${paintAuthBackdrop.toString()})(document.getElementById('authScenery'));
(()=>{
 const svg=document.querySelector('#svgSceneLayer svg');if(!svg)return;
 const layer=svg.querySelector('#interactiveEnvelopesLayer'),NS='http://www.w3.org/2000/svg';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 800px)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 const configs=[
      // 1. Hero Foreground Left
      {
        id: 'hero-left',
        baseX: 188, baseY: 558, scale: 0.86, baseRot: -18.5,
        filter: null, opacity: 1.0,
        floatAmpX: 10, floatAmpY: 14, floatSpeed: 1.15, phase: 0.2,
        pullRadius: 310, pullStrength: 0.38
      },
      // 2. Top-Right Corner
      {
        id: 'top-right',
        baseX: 1215, baseY: 74, scale: 0.56, baseRot: 14,
        filter: 'url(#dof-top-right)', opacity: 0.95,
        floatAmpX: 12, floatAmpY: 11, floatSpeed: 0.95, phase: 1.4,
        pullRadius: 270, pullStrength: 0.42
      },
      // 3. Mid-Right
      {
        id: 'mid-right',
        baseX: 1235, baseY: 405, scale: 0.46, baseRot: -14,
        filter: 'url(#dof-mid)', opacity: 0.92,
        floatAmpX: 9, floatAmpY: 13, floatSpeed: 1.25, phase: 2.7,
        pullRadius: 260, pullStrength: 0.44
      },
      // 4. Center Midground
      {
        id: 'center-valley',
        baseX: 572, baseY: 588, scale: 0.40, baseRot: 28,
        filter: 'url(#dof-far)', opacity: 0.88,
        floatAmpX: 11, floatAmpY: 10, floatSpeed: 1.05, phase: 3.9,
        pullRadius: 250, pullStrength: 0.48
      },
      // 5. Bottom-Right Foreground
      {
        id: 'bottom-right',
        baseX: 1190, baseY: 728, scale: 0.74, baseRot: -22,
        filter: 'url(#dof-foreground)', opacity: 0.94,
        floatAmpX: 14, floatAmpY: 12, floatSpeed: 0.88, phase: 5.1,
        pullRadius: 300, pullStrength: 0.36
      },
      // 6. Upper-Left
      {
        id: 'upper-left-spire',
        baseX: 82, baseY: 158, scale: 0.38, baseRot: 18,
        filter: 'url(#dof-mid)', opacity: 0.86,
        floatAmpX: 12, floatAmpY: 9, floatSpeed: 1.18, phase: 0.9,
        pullRadius: 260, pullStrength: 0.46
      },
      // 7. Mid-Left
      {
        id: 'mid-left-dome',
        baseX: 64, baseY: 368, scale: 0.50, baseRot: -25,
        filter: 'url(#dof-top-right)', opacity: 0.93,
        floatAmpX: 10, floatAmpY: 13, floatSpeed: 1.02, phase: 2.1,
        pullRadius: 275, pullStrength: 0.45
      },
      // 8. High Center-Left
      {
        id: 'high-sky-center',
        baseX: 525, baseY: 96, scale: 0.33, baseRot: -15,
        filter: 'url(#dof-far)', opacity: 0.82,
        floatAmpX: 14, floatAmpY: 8, floatSpeed: 0.92, phase: 4.4,
        pullRadius: 250, pullStrength: 0.50
      },
      // 9. Center-Left
      {
        id: 'orbital-ring-left',
        baseX: 432, baseY: 462, scale: 0.47, baseRot: 15,
        filter: 'url(#dof-top-right)', opacity: 0.91,
        floatAmpX: 9, floatAmpY: 12, floatSpeed: 1.12, phase: 1.7,
        pullRadius: 270, pullStrength: 0.46
      },
      // 10. Upper-Center Distant
      {
        id: 'archway-citadel',
        baseX: 638, baseY: 285, scale: 0.31, baseRot: -21,
        filter: 'url(#dof-far)', opacity: 0.80,
        floatAmpX: 11, floatAmpY: 9, floatSpeed: 1.30, phase: 3.2,
        pullRadius: 250, pullStrength: 0.50
      },
      // 11. Lower-Center
      {
        id: 'lower-center-wave',
        baseX: 418, baseY: 718, scale: 0.58, baseRot: -11,
        filter: 'url(#dof-top-right)', opacity: 0.94,
        floatAmpX: 12, floatAmpY: 11, floatSpeed: 0.98, phase: 5.8,
        pullRadius: 280, pullStrength: 0.42
      },
      // 12. Top-Right Mid
      {
        id: 'top-constellation-bridge',
        baseX: 965, baseY: 54, scale: 0.42, baseRot: -19,
        filter: 'url(#dof-mid)', opacity: 0.89,
        floatAmpX: 10, floatAmpY: 10, floatSpeed: 1.08, phase: 2.4,
        pullRadius: 260, pullStrength: 0.46
      },
      // 13. Lower-Mid
      {
        id: 'lower-mid-mist',
        baseX: 665, baseY: 732, scale: 0.48, baseRot: 21,
        filter: 'url(#dof-mid)', opacity: 0.90,
        floatAmpX: 11, floatAmpY: 12, floatSpeed: 1.16, phase: 4.9,
        pullRadius: 265, pullStrength: 0.44
      },
      // 14. Mid-Left Breezeway
      {
        id: 'mid-left-breeze',
        baseX: 295, baseY: 425, scale: 0.36, baseRot: 24,
        filter: 'url(#dof-mid)', opacity: 0.85,
        floatAmpX: 13, floatAmpY: 10, floatSpeed: 1.22, phase: 3.5,
        pullRadius: 260, pullStrength: 0.48
      }
    ];
 const mouse={x:0,y:0,active:false};let frame=0,last=0,elapsed=0;
 const instances=configs.map((cfg,i)=>{
  const outer=document.createElementNS(NS,'g'),flip=document.createElementNS(NS,'g'),front=document.createElementNS(NS,'use'),back=document.createElementNS(NS,'use');
  outer.classList.add('scene-envelope');outer.dataset.envelope=cfg.id;outer.setAttribute('opacity',cfg.opacity);if(cfg.filter)outer.setAttribute('filter',cfg.filter);
  front.setAttribute('href','#glassEnvelopeFront'+(i%2?'Z':'V'));back.setAttribute('href','#glassEnvelopeBack'+(i%2?'V':'Z'));back.setAttribute('transform','scale(-1 1)');back.style.display='none';flip.append(front,back);outer.append(flip);layer.append(outer);
  return {cfg,outer,flip,front,back,x:cfg.baseX,y:cfg.baseY,angle:0,index:i};
 });
 function draw(dt){
  for(const e of instances){
   const c=e.cfg,still=reduced.matches,small=mobile.matches;
   e.outer.style.display=small&&e.index>3?'none':'';
   if(small&&e.index>3)continue;
   const t=elapsed*.00055*c.floatSpeed+c.phase;
   let x=c.baseX+(still?0:Math.sin(t)*c.floatAmpX),y=c.baseY+(still?0:Math.cos(t*.85)*c.floatAmpY*(small?.45:1));
   let near=0;
   if(mouse.active&&fine.matches&&!small&&!still){const dx=mouse.x-x,dy=mouse.y-y;near=Math.max(0,1-Math.hypot(dx,dy)/(c.pullRadius*1.25));const ease=near*near*(3-2*near);x+=Math.max(-48,Math.min(48,dx*c.pullStrength))*ease;y+=Math.max(-38,Math.min(38,dy*c.pullStrength))*ease;}
   const follow=still?1:1-Math.exp(-dt/180);e.x+=(x-e.x)*follow;e.y+=(y-e.y)*follow;
   // A few staggered, time-based flips. Frames and refresh rate do not change their timing.
   const cycle=(elapsed+e.index*3700)%32000;let target=0;
   if(!still&&!small&&e.index%3===0){if(near>.35)target=Math.PI;else if(cycle>24000&&cycle<29000){const phase=(cycle-24000)/5000;target=Math.PI*2*(phase*phase*(3-2*phase));}}
   e.angle+=(target-e.angle)*(still?1:1-Math.exp(-dt/300));const cos=Math.cos(e.angle);
   e.front.style.display=cos<0?'none':'';e.back.style.display=cos<0?'':'none';
   e.outer.setAttribute('transform',\`translate(\${e.x.toFixed(2)} \${e.y.toFixed(2)}) rotate(\${(c.baseRot+(still?0:Math.sin(t*.7)*3.2)).toFixed(2)}) scale(\${c.scale})\`);
   e.flip.setAttribute('transform',\`scale(\${((cos<0?-1:1)*Math.max(.04,Math.abs(cos))).toFixed(3)} 1) skewY(\${(Math.sin(e.angle)*8.5).toFixed(2)})\`);
  }
 }
 function tick(now){frame=0;const dt=Math.min(50,last?now-last:16);last=now;elapsed+=dt;draw(dt);if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
 function resume(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;mouse.active=false;draw(1000);if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
 window.addEventListener('pointermove',e=>{if(!fine.matches||mobile.matches||reduced.matches)return;const matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());mouse.x=p.x;mouse.y=p.y;mouse.active=true;},{passive:true});
 document.documentElement.addEventListener('pointerleave',()=>mouse.active=false);window.addEventListener('blur',()=>mouse.active=false);
 document.addEventListener('visibilitychange',resume);window.addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',resume);
 for(const media of [reduced,mobile,fine])media.addEventListener('change',resume);
 resume();
})();
`;
