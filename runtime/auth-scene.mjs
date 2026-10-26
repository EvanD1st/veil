/* Adapted from the operator-supplied VEIL design. Decorative only; authentication stays server-side. */
export const sceneStyles=`
.auth-layout{min-height:100svh;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,510px);align-items:center;gap:6vw;padding:100px 8vw 44px;isolation:isolate;overflow-x:hidden;background:#f2e9d8;color:#211b13}
.auth-layout:before{content:"";position:fixed;inset:0;z-index:-3;background:radial-gradient(ellipse at 14% 12%,#fffdf5d9,transparent 68%),linear-gradient(135deg,#f5f3eb 0%,#f8edda 38%,#eee1c7 75%,#ddcaa0)}
.auth-scene{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden}.auth-scene svg{width:100%;height:100%;display:block}
.auth-brand{position:absolute;top:30px;left:4vw;color:#2a2113;letter-spacing:.3em;font:30px Georgia;text-decoration:none}.testnet{font:10px system-ui;letter-spacing:.14em;border-radius:20px;padding:7px 12px;background:#dfdfd2d9;margin-left:12px;vertical-align:middle}
.auth-story{align-self:start;margin-top:6vh;max-width:600px}.eyebrow{font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:#7c725e}.auth-story h2{font:clamp(58px,7.5vw,112px)/.97 Georgia;letter-spacing:-.05em;margin:22px 0;color:#211b13}.auth-story p:last-child{font-size:20px;color:#7c725e;max-width:420px}
.auth-layout main{width:100%;max-width:510px;margin:0;background:linear-gradient(155deg,#eff0eabd,#e1e4dc9e 48%,#d6dbd2a8);border:1.5px solid #ffffffc2;border-radius:18px;padding:34px 38px;box-shadow:0 28px 68px -12px #0c181038,0 4px 16px #0c181014,inset 0 1px 1px #ffffffe6;backdrop-filter:blur(24px) saturate(112%);-webkit-backdrop-filter:blur(24px) saturate(112%)}
.auth-layout main>.brand{display:none}.auth-layout h1{text-align:center;font:42px Georgia;letter-spacing:-.035em;margin:0 0 12px}.auth-subtitle{text-align:center;color:#7c725e;margin:0 0 16px}.auth-intro{text-align:center;font-size:12px;color:#7c725e;margin:0 0 22px}.auth-layout label{font-size:14px;margin-top:15px}.auth-layout input{background:#f6f6f2e0;border-color:#d4d7cfe6;height:49px;box-shadow:inset 0 1px 2px #211b1308}.auth-layout input:focus{background:#fcfcf9f5}.auth-layout small{font-size:11px;margin-top:4px}.auth-layout .toggle{font-size:12px;padding:5px 0;display:block;text-align:right;width:100%}.auth-layout button[type=submit]{background:#302517;min-height:49px;margin-top:20px;box-shadow:0 4px 14px #211b1338}.auth-layout button[type=submit]:hover{background:#594222}.auth-layout .button{background:#ebede77a;border-color:#6e6250;margin:18px 0;text-decoration:none}.auth-layout .recovery{text-align:center;margin-top:18px}.auth-layout .error{font-size:14px}.auth-divider{display:flex;align-items:center;gap:16px;font-size:12px;color:#7c725e;margin-top:24px}.auth-divider:before,.auth-divider:after{content:"";height:1px;background:#8b948b4d;flex:1}.auth-layout input:focus-visible,.auth-layout button:focus-visible,.auth-layout a:focus-visible{outline-color:#aa8b3b}
/* Compact login preserves usable controls rather than hiding overflow. */
:is(.auth-login,.auth-signup){padding-top:76px;padding-bottom:24px}:is(.auth-login,.auth-signup) main{padding:24px 32px}:is(.auth-login,.auth-signup) h1{font-size:36px;margin-bottom:8px}:is(.auth-login,.auth-signup) .auth-subtitle{font-size:15px;margin-bottom:10px}:is(.auth-login,.auth-signup) .auth-intro{margin-bottom:12px}:is(.auth-login,.auth-signup) label{margin-top:10px}:is(.auth-login,.auth-signup) input{height:44px}:is(.auth-login,.auth-signup) .toggle{padding:3px 0}:is(.auth-login,.auth-signup) button[type=submit]{margin-top:12px;min-height:44px;padding:10px}:is(.auth-login,.auth-signup) .auth-divider{margin-top:16px}:is(.auth-login,.auth-signup) .button{margin:12px 0;padding:10px}:is(.auth-login,.auth-signup) .recovery{margin-top:10px}
@media(min-width:801px) and (max-height:700px){:is(.auth-login,.auth-signup){padding-top:66px;padding-bottom:16px;gap:4vw}:is(.auth-login,.auth-signup) main{padding:18px 26px}:is(.auth-login,.auth-signup) h1{font-size:32px;margin-bottom:6px}:is(.auth-login,.auth-signup) .auth-intro{font-size:11px;margin-bottom:8px}:is(.auth-login,.auth-signup) .auth-subtitle{margin-bottom:8px}:is(.auth-login,.auth-signup) label{margin-top:7px}:is(.auth-login,.auth-signup) input{height:40px;padding:8px 12px}:is(.auth-login,.auth-signup) button[type=submit]{min-height:40px;margin-top:8px}:is(.auth-login,.auth-signup) .auth-divider{margin-top:10px}:is(.auth-login,.auth-signup) .button{margin:9px 0;padding:8px}:is(.auth-login,.auth-signup) .recovery{font-size:10px;margin-top:8px}:is(.auth-login,.auth-signup) .auth-story{margin-top:3vh}:is(.auth-login,.auth-signup) .auth-story h2{font-size:clamp(54px,7vw,86px)}}
@media(min-width:801px) and (max-height:760px){.auth-signup{padding-top:62px;padding-bottom:14px}.auth-signup main{padding:16px 26px}.auth-signup h1{font-size:30px;margin-bottom:5px}.auth-signup .auth-subtitle{font-size:14px;margin-bottom:6px}.auth-signup .auth-intro{font-size:11px;margin-bottom:7px}.auth-signup label{margin-top:6px;margin-bottom:4px}.auth-signup input{height:38px;padding:7px 12px}.auth-signup small{font-size:10px;line-height:1.35;margin-top:3px}.auth-signup .toggle{font-size:11px;padding:2px 0;line-height:1.4}.auth-signup button[type=submit]{min-height:40px;margin-top:9px;padding:8px}.auth-signup form+p{font-size:13px;margin:10px 0}.auth-signup .recovery{margin-top:8px}}
@supports not (backdrop-filter:blur(1px)){.auth-layout main{background:#eff0eaeb}}
@media(max-width:800px){.auth-layout{grid-template-columns:1fr;padding:100px 20px 35px;gap:22px}.auth-brand{top:25px;left:24px}.auth-story{margin:0 auto;width:100%;max-width:510px}.auth-story h2{font-size:52px;margin:12px 0}.auth-story h2 br{display:none}.auth-story p:last-child{font-size:16px;margin:12px 0}.auth-layout main{margin:0 auto;padding:26px 24px;background:#eff0eabf;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.auth-layout h1{font-size:36px}}
`;
export const sceneMarkup=`<div id="svgSceneLayer" class="auth-scene" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice"><defs>
        <!-- Blur Filters for Depth of Field -->
        <filter id="dof-far" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id="dof-mid" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="dof-top-right" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id="dof-foreground" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="6.5" />
        </filter>
        <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="seal-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="6" stdDeviation="5" flood-color="#221b12" flood-opacity="0.55" />
        </filter>

        <!-- Frosted Glass Gradients -->
        <linearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.62" />
          <stop offset="35%" stop-color="#f5eddc" stop-opacity="0.38" />
          <stop offset="70%" stop-color="#e9ddc3" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#fff8e9" stop-opacity="0.52" />
        </linearGradient>

        <linearGradient id="glassFlapTop" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
          <stop offset="55%" stop-color="#f4ead8" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#e8d8b3" stop-opacity="0.22" />
        </linearGradient>

        <linearGradient id="glassFlapBottom" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.48" />
          <stop offset="100%" stop-color="#e4d4b0" stop-opacity="0.32" />
        </linearGradient>

        <linearGradient id="goldEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff3c4" stop-opacity="0.95" />
          <stop offset="40%" stop-color="#d4b263" stop-opacity="0.85" />
          <stop offset="75%" stop-color="#8d7232" stop-opacity="0.65" />
          <stop offset="100%" stop-color="#f7e39c" stop-opacity="0.9" />
        </linearGradient>

        <!-- Glass Ribbon Gradients -->
        <linearGradient id="ribbonGlass1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
          <stop offset="30%" stop-color="#f4e8cd" stop-opacity="0.22" />
          <stop offset="75%" stop-color="#c8b991" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.48" />
        </linearGradient>

        <linearGradient id="ribbonGlass2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
          <stop offset="50%" stop-color="#eee0c5" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#fff9ed" stop-opacity="0.46" />
        </linearGradient>

        <!-- Emerald Wax Seal Gradients -->
        <radialGradient id="waxSealOuter" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ad9461" />
          <stop offset="45%" stop-color="#483821" />
          <stop offset="85%" stop-color="#2b2215" />
          <stop offset="100%" stop-color="#887044" />
        </radialGradient>

        <radialGradient id="waxSealInner" cx="65%" cy="70%" r="65%">
          <stop offset="0%" stop-color="#261e12" />
          <stop offset="60%" stop-color="#3b2e1c" />
          <stop offset="100%" stop-color="#9d8453" />
        </radialGradient>

        <!-- Reusable Wax Seal Component -->
        <g id="veilWaxSeal">
          <!-- Outer wax rim with gold highlight -->
          <circle cx="0" cy="0" r="34" fill="url(#waxSealOuter)" stroke="url(#goldEdgeGrad)" stroke-width="1.6" filter="url(#seal-shadow)" />
          <!-- Organic wax ring ridge -->
          <circle cx="0" cy="0" r="29.5" fill="none" stroke="#6d5d30" stroke-width="0.9" stroke-opacity="0.7" />
          <circle cx="0" cy="0" r="26.5" fill="url(#waxSealInner)" stroke="url(#goldEdgeGrad)" stroke-width="1.1" />
          <!-- Specular wax sheen -->
          <path d="M -20 -16 A 26 26 0 0 1 18 -18" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" stroke-linecap="round" />
          <path d="M -18 19 A 26 26 0 0 0 21 14" fill="none" stroke="rgba(255,230,155,0.25)" stroke-width="1.5" stroke-linecap="round" />
          <!-- Embossed Golden Serif 'V' -->
          <g transform="translate(0, 2)">
            <!-- Serif tops -->
            <line x1="-13.5" y1="-13" x2="-6.5" y2="-13" stroke="url(#goldEdgeGrad)" stroke-width="1.8" stroke-linecap="round" />
            <line x1="6.5" y1="-13" x2="13.5" y2="-13" stroke="url(#goldEdgeGrad)" stroke-width="1.8" stroke-linecap="round" />
            <!-- Left thick stroke of V -->
            <path d="M -10.5 -13 L -0.5 12 L 1.2 12 L -8.2 -13 Z" fill="url(#goldEdgeGrad)" />
            <!-- Right thin stroke of V -->
            <line x1="10.2" y1="-13" x2="0.4" y2="12" stroke="url(#goldEdgeGrad)" stroke-width="1.7" stroke-linecap="round" />
          </g>
        </g>

        <!-- Reusable Glass Envelope FRONT Template (320 x 210 centered at 0,0) -->
        <g id="glassEnvelopeFront">
          <!-- Back shadow & glow -->
          <rect x="-160" y="-105" width="320" height="210" rx="10" fill="rgba(18, 32, 22, 0.18)" transform="translate(4, 10)" />
          <!-- Main translucent body -->
          <rect x="-160" y="-105" width="320" height="210" rx="9" fill="url(#glassBodyGrad)" stroke="rgba(255,255,255,0.78)" stroke-width="2" />
          <!-- Inner subtle glass bevel -->
          <rect x="-155" y="-100" width="310" height="200" rx="6" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="0.9" stroke-opacity="0.65" />
          <!-- Left & Right side folds -->
          <path d="M -158 -102 L 0 8 L -158 102 Z" fill="rgba(255,255,255,0.16)" stroke="url(#goldEdgeGrad)" stroke-width="1.1" />
          <path d="M 158 -102 L 0 8 L 158 102 Z" fill="rgba(210,218,205,0.18)" stroke="url(#goldEdgeGrad)" stroke-width="1.1" />
          <!-- Bottom Flap -->
          <path d="M -158 103 L -12 -8 Q 0 -17 12 -8 L 158 103 Z" fill="url(#glassFlapBottom)" stroke="url(#goldEdgeGrad)" stroke-width="1.4" />
          <!-- Top Sealing Flap -->
          <path d="M -158 -103 L -10 12 Q 0 21 10 12 L 158 -103 Z" fill="url(#glassFlapTop)" stroke="url(#goldEdgeGrad)" stroke-width="1.6" />
          <!-- Specular crystalline edge streaks -->
          <line x1="-145" y1="-103" x2="120" y2="-103" stroke="#ffffff" stroke-width="2.4" stroke-opacity="0.85" stroke-linecap="round" />
          <line x1="-159" y1="-90" x2="-159" y2="85" stroke="#ffffff" stroke-width="2" stroke-opacity="0.7" stroke-linecap="round" />
          <!-- Central Wax Seal -->
          <use href="#veilWaxSeal" x="0" y="2" />
        </g>

        <!-- Reusable Glass Envelope BACK Template (Revealed when flipped 180 deg) -->
        <g id="glassEnvelopeBack">
          <!-- Back shadow & glow -->
          <rect x="-160" y="-105" width="320" height="210" rx="10" fill="rgba(18, 32, 22, 0.22)" transform="translate(-4, 10)" />
          <!-- Frosted glass rear body -->
          <rect x="-160" y="-105" width="320" height="210" rx="9" fill="url(#glassBodyGrad)" stroke="rgba(255,255,255,0.82)" stroke-width="2" />
          <!-- Inner golden cryptographic frame -->
          <rect x="-148" y="-93" width="296" height="186" rx="5" fill="rgba(244, 246, 240, 0.22)" stroke="url(#goldEdgeGrad)" stroke-width="1.1" stroke-opacity="0.8" />
          <rect x="-140" y="-85" width="280" height="170" rx="3" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.8" stroke-dasharray="6 4" />

          <!-- Faint refracted X-seams visible through the frosted glass from the front -->
          <line x1="-148" y1="-93" x2="148" y2="93" stroke="url(#goldEdgeGrad)" stroke-width="0.7" stroke-opacity="0.35" />
          <line x1="148" y1="-93" x2="-148" y2="93" stroke="url(#goldEdgeGrad)" stroke-width="0.7" stroke-opacity="0.35" />

          <!-- Sealed Bid Document Card visible inside the translucent envelope -->
          <rect x="-112" y="-64" width="224" height="128" rx="4" fill="rgba(255, 255, 252, 0.34)" stroke="url(#goldEdgeGrad)" stroke-width="0.9" />

          <!-- Sacred Geometry / Zero-Knowledge Proof Rings on the back -->
          <circle cx="0" cy="0" r="46" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="1.1" stroke-opacity="0.85" />
          <circle cx="0" cy="0" r="38" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="0.8" stroke-dasharray="3 3" stroke-opacity="0.75" />
          <polygon points="0,-44 38,22 -38,22" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="0.8" stroke-opacity="0.55" />
          <polygon points="0,44 38,-22 -38,-22" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="0.8" stroke-opacity="0.55" />

          <!-- Horizontal golden cipher inscription lines -->
          <line x1="-92" y1="-42" x2="-48" y2="-42" stroke="url(#goldEdgeGrad)" stroke-width="1.5" stroke-linecap="round" />
          <line x1="-92" y1="-32" x2="-62" y2="-32" stroke="url(#goldEdgeGrad)" stroke-width="1" stroke-opacity="0.7" stroke-linecap="round" />
          <line x1="48" y1="-42" x2="92" y2="-42" stroke="url(#goldEdgeGrad)" stroke-width="1.5" stroke-linecap="round" />
          <line x1="62" y1="-32" x2="92" y2="-32" stroke="url(#goldEdgeGrad)" stroke-width="1" stroke-opacity="0.7" stroke-linecap="round" />

          <line x1="-88" y1="42" x2="88" y2="42" stroke="url(#goldEdgeGrad)" stroke-width="1.1" stroke-opacity="0.75" stroke-linecap="round" />
          <line x1="-55" y1="50" x2="55" y2="50" stroke="url(#goldEdgeGrad)" stroke-width="0.9" stroke-opacity="0.55" stroke-linecap="round" />

          <!-- Glowing constellation nodes at corners of inner cipher card -->
          <circle cx="-112" cy="-64" r="2.5" fill="#fff6cc" />
          <circle cx="112" cy="-64" r="2.5" fill="#fff6cc" />
          <circle cx="-112" cy="64" r="2.5" fill="#fff6cc" />
          <circle cx="112" cy="64" r="2.5" fill="#fff6cc" />

          <!-- Rear Emerald Wax Seal Medallion with Sealed Keyhole/Crest -->
          <circle cx="0" cy="0" r="24" fill="url(#waxSealInner)" stroke="url(#goldEdgeGrad)" stroke-width="1.5" filter="url(#seal-shadow)" />
          <circle cx="0" cy="0" r="18" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="0.8" stroke-opacity="0.7" />
          <!-- Diamond & ZK Key emblem on the back of the seal -->
          <polygon points="0,-11 9,0 0,11 -9,0" fill="none" stroke="url(#goldEdgeGrad)" stroke-width="1.4" />
          <circle cx="0" cy="0" r="3" fill="#f7e39c" />

          <!-- Specular crystalline edge streaks -->
          <line x1="-135" y1="-103" x2="140" y2="-103" stroke="#ffffff" stroke-width="2.4" stroke-opacity="0.85" stroke-linecap="round" />
          <line x1="159" y1="-85" x2="159" y2="85" stroke="#ffffff" stroke-width="2" stroke-opacity="0.7" stroke-linecap="round" />
        </g>

        <!-- Legacy alias so any static reference still works -->
        <g id="glassEnvelope">
          <use href="#glassEnvelopeFront" />
        </g>
      </defs><g id="interactiveEnvelopesLayer"></g></svg></div><a class="auth-brand" href="/">VEIL<span class="testnet">TESTNET</span></a><aside class="auth-story"><p class="eyebrow">Private auctions</p><h2>Your bid.<br> Your secret.</h2><p>Sealed until the moment that matters.</p></aside>`;
export const sceneScript=`
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
  front.setAttribute('href','#glassEnvelopeFront');back.setAttribute('href','#glassEnvelopeBack');back.setAttribute('transform','scale(-1 1)');back.style.display='none';flip.append(front,back);outer.append(flip);layer.append(outer);
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
