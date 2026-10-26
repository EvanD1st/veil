// Static decorative paintings adapted from the operator-supplied HTML. No auction or account state.
    export function paintHero(canvas) {
      const heroCanvas=canvas,heroCtx=canvas.getContext('2d');if(!heroCtx)return;
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth<600?1:1.5);
      const W = 1280;
      const H = 450;
      heroCanvas.width = W * dpr;
      heroCanvas.height = H * dpr;
      heroCtx.save();
      heroCtx.scale(dpr, dpr);

      // Base warm ivory-champagne silk backdrop
      const bgGrad = heroCtx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0.0, '#fbf8f1');
      bgGrad.addColorStop(0.45, '#f6efe2');
      bgGrad.addColorStop(0.78, '#ede0c8');
      bgGrad.addColorStop(1.0, '#e3cfa9');
      heroCtx.fillStyle = bgGrad;
      heroCtx.fillRect(0, 0, W, H);

      // Warm golden subsurface glow beneath the main hero envelopes (right side)
      const goldSpots = [
        { x: 920, y: 260, r: 340, alpha: 0.62 },
        { x: 740, y: 410, r: 230, alpha: 0.58 },
        { x: 1120, y: 185, r: 260, alpha: 0.48 },
        { x: 580, y: 160, r: 220, alpha: 0.25 }
      ];
      goldSpots.forEach(s => {
        const g = heroCtx.createRadialGradient(s.x, s.y, 12, s.x, s.y, s.r);
        g.addColorStop(0, `rgba(248, 200, 78, ${s.alpha})`);
        g.addColorStop(0.45, `rgba(242, 212, 138, ${s.alpha * 0.55})`);
        g.addColorStop(1, 'rgba(245, 232, 205, 0)');
        heroCtx.fillStyle = g;
        heroCtx.fillRect(0, 0, W, H);
      });

      // Flowing Sculpted Ivory Silk Drapes & Folds
      const silkFolds = [
        // Sweeping diagonal fold from top-right to center-bottom
        {
          pts: [[780, -30], [980, -30], [720, 470], [420, 470]],
          x1: 650, y1: 0, x2: 860, y2: 450,
          c0: 'rgba(255, 253, 248, 0.85)',
          c1: 'rgba(241, 229, 206, 0.72)',
          c2: 'rgba(214, 193, 156, 0.55)'
        },
        // Billowing lower-center silk wave
        {
          pts: [[180, 460], [520, 290], [880, 340], [1290, 460]],
          x1: 520, y1: 280, x2: 620, y2: 460,
          c0: 'rgba(255, 252, 244, 0.92)',
          c1: 'rgba(238, 224, 198, 0.78)',
          c2: 'rgba(205, 182, 142, 0.62)'
        },
        // Right-hand sunlit satin ridge behind the Z envelope
        {
          pts: [[960, -20], [1290, -20], [1290, 450], [820, 450]],
          x1: 950, y1: 60, x2: 1260, y2: 390,
          c0: 'rgba(255, 250, 238, 0.70)',
          c1: 'rgba(236, 218, 182, 0.58)',
          c2: 'rgba(204, 176, 128, 0.52)'
        }
      ];

      silkFolds.forEach(fold => {
        heroCtx.save();
        heroCtx.beginPath();
        heroCtx.moveTo(fold.pts[0][0], fold.pts[0][1]);
        heroCtx.bezierCurveTo(
          fold.pts[1][0], fold.pts[1][1],
          fold.pts[2][0], fold.pts[2][1],
          fold.pts[3][0], fold.pts[3][1]
        );
        heroCtx.lineTo(W, H);
        heroCtx.lineTo(0, H);
        heroCtx.closePath();

        const fg = heroCtx.createLinearGradient(fold.x1, fold.y1, fold.x2, fold.y2);
        fg.addColorStop(0, fold.c0);
        fg.addColorStop(0.55, fold.c1);
        fg.addColorStop(1, fold.c2);
        heroCtx.fillStyle = fg;
        heroCtx.fill();
        heroCtx.restore();
      });

      // Soft silk ridge highlights (curved champagne light seams)
      const silkSeams = [
        { m: [320, 445], c1: [520, 315], c2: [680, 325], e: [890, 455], w: 28, a: 0.65 },
        { m: [640, 375], c1: [760, 290], c2: [920, 330], e: [1180, 445], w: 34, a: 0.72 },
        { m: [890, -20], c1: [810, 110], c2: [720, 210], e: [560, 350], w: 26, a: 0.55 },
        { m: [1190, -10], c1: [1120, 120], c2: [1080, 240], e: [1270, 390], w: 30, a: 0.60 }
      ];
      silkSeams.forEach(s => {
        heroCtx.save();
        heroCtx.beginPath();
        heroCtx.moveTo(s.m[0], s.m[1]);
        heroCtx.bezierCurveTo(s.c1[0], s.c1[1], s.c2[0], s.c2[1], s.e[0], s.e[1]);
        heroCtx.lineWidth = s.w;
        heroCtx.lineCap = 'round';
        heroCtx.strokeStyle = `rgba(255, 252, 244, ${s.a})`;
        heroCtx.stroke();
        heroCtx.restore();
      });

      // Warm golden caustic sparkles along the silk valley beneath the foreground envelope
      const sparkles = [
        { x: 755, y: 405, r: 42 },
        { x: 725, y: 392, r: 24 },
        { x: 1035, y: 295, r: 55 },
        { x: 675, y: 215, r: 36 }
      ];
      sparkles.forEach(sp => {
        const sg = heroCtx.createRadialGradient(sp.x, sp.y, 1, sp.x, sp.y, sp.r);
        sg.addColorStop(0, 'rgba(255, 248, 210, 0.95)');
        sg.addColorStop(0.35, 'rgba(248, 202, 75, 0.55)');
        sg.addColorStop(1, 'rgba(248, 202, 75, 0)');
        heroCtx.fillStyle = sg;
        heroCtx.beginPath();
        heroCtx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        heroCtx.fill();
      });

      heroCtx.restore();
    }


    export function drawMidnightEditionArtwork(c) {
      if (!c) return;
      const ctx = c.getContext('2d');if(!ctx)return;
      const W = c.width, H = c.height;

      // 1. Sunlit Limestone Studio Backdrop with Diagonal Architectural Shadows
      const wallGrad = ctx.createLinearGradient(0, 0, W, H);
      wallGrad.addColorStop(0, '#cfc5b4');
      wallGrad.addColorStop(0.5, '#dfd7c8');
      wallGrad.addColorStop(1, '#c3b8a6');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, W, H);

      // Diagonal sunlit window beam
      ctx.save();
      ctx.fillStyle = 'rgba(255, 250, 240, 0.42)';
      ctx.beginPath();
      ctx.moveTo(290, 0);
      ctx.lineTo(590, 0);
      ctx.lineTo(380, H);
      ctx.lineTo(90, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Travertine Limestone Plinth at Bottom
      const plinthY = 368;
      const plinthGrad = ctx.createLinearGradient(0, plinthY, W, H);
      plinthGrad.addColorStop(0, '#efe9de');
      plinthGrad.addColorStop(0.22, '#ded5c5');
      plinthGrad.addColorStop(1, '#bfb39f');
      ctx.fillStyle = plinthGrad;
      ctx.beginPath();
      ctx.moveTo(0, plinthY + 8);
      ctx.lineTo(W - 40, plinthY - 4);
      ctx.lineTo(W, plinthY + 12);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Plinth contact shadow under sneaker
      const shadowGrad = ctx.createRadialGradient(365, 368, 15, 365, 368, 255);
      shadowGrad.addColorStop(0, 'rgba(20, 16, 10, 0.68)');
      shadowGrad.addColorStop(0.6, 'rgba(38, 30, 18, 0.28)');
      shadowGrad.addColorStop(1, 'rgba(38, 30, 18, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(365, 369, 250, 19, -0.02, 0, Math.PI * 2);
      ctx.fill();

      // Helper for metallic 24K Gold gradient
      function makeGoldGrad(x1, y1, x2, y2) {
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0.0, '#fff6c4');
        g.addColorStop(0.22, '#edc14c');
        g.addColorStop(0.48, '#9c6b12');
        g.addColorStop(0.74, '#f5d061');
        g.addColorStop(1.0, '#5e3c04');
        return g;
      }

      // 3. Sneaker Silhouette Base (Obsidian Woven Carbon & Matte Leather)
      ctx.save();
      ctx.beginPath();
      // Heel base -> ankle collar -> tongue peak -> slope down to toe box -> chunky sculpted sole
      ctx.moveTo(132, 332);
      ctx.bezierCurveTo(118, 265, 138, 195, 162, 135); // Heel counter
      ctx.bezierCurveTo(175, 118, 198, 128, 228, 145); // Collar dip
      ctx.bezierCurveTo(260, 110, 275, 62, 305, 58);   // High sculptural tongue peak
      ctx.bezierCurveTo(332, 56, 365, 115, 428, 168);  // Lacing throat slope
      ctx.bezierCurveTo(495, 210, 585, 222, 608, 278); // Sleek aerodynamic toe box
      ctx.bezierCurveTo(618, 312, 598, 348, 550, 355); // Toe bumper
      ctx.lineTo(155, 362);
      ctx.quadraticCurveTo(125, 358, 132, 332);
      ctx.closePath();

      const obsidianGrad = ctx.createLinearGradient(140, 70, 580, 360);
      obsidianGrad.addColorStop(0, '#2c2a29');
      obsidianGrad.addColorStop(0.4, '#141312');
      obsidianGrad.addColorStop(0.8, '#090808');
      obsidianGrad.addColorStop(1, '#23201c');
      ctx.fillStyle = obsidianGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3a352d';
      ctx.stroke();

      // 4. Liquid 24K Gold Aerodynamic Side Cage Waves
      ctx.beginPath();
      ctx.moveTo(142, 245);
      ctx.bezierCurveTo(215, 185, 335, 195, 455, 255);
      ctx.bezierCurveTo(515, 285, 568, 275, 602, 292);
      ctx.bezierCurveTo(575, 322, 470, 325, 370, 298);
      ctx.bezierCurveTo(265, 268, 195, 285, 136, 315);
      ctx.closePath();
      ctx.fillStyle = makeGoldGrad(140, 190, 600, 320);
      ctx.fill();

      // Inner obsidian cutout panels inside the gold cage
      const cutouts = [
        [[235, 215], [335, 212], [385, 258], [260, 252]],
        [[415, 225], [495, 245], [538, 278], [445, 268]],
        [[158, 218], [218, 188], [238, 225], [168, 242]]
      ];
      cutouts.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        ctx.quadraticCurveTo(p[1][0], p[1][1], p[2][0], p[2][1]);
        ctx.quadraticCurveTo(p[3][0], p[3][1], p[0][0], p[0][1]);
        ctx.closePath();
        ctx.fillStyle = '#121110';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#f5d265';
        ctx.stroke();
      });

      // 5. Sculpted Chunky Bio-Mechanical 24K Gold & Obsidian Midsole
      ctx.beginPath();
      ctx.moveTo(124, 318);
      ctx.bezierCurveTo(185, 282, 285, 292, 378, 312);
      ctx.bezierCurveTo(468, 332, 552, 305, 608, 312);
      ctx.bezierCurveTo(612, 344, 582, 364, 525, 365);
      ctx.bezierCurveTo(435, 366, 385, 348, 332, 356);
      ctx.bezierCurveTo(265, 366, 175, 368, 135, 355);
      ctx.closePath();
      ctx.fillStyle = makeGoldGrad(120, 285, 610, 368);
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#fff3b8';
      ctx.stroke();

      // Dark obsidian outsole pods & air chambers
      const solePods = [
        { x: 188, y: 342, rx: 38, ry: 13 },
        { x: 282, y: 346, rx: 32, ry: 11 },
        { x: 458, y: 346, rx: 44, ry: 12 },
        { x: 552, y: 340, rx: 28, ry: 10 }
      ];
      solePods.forEach(pod => {
        ctx.beginPath();
        ctx.ellipse(pod.x, pod.y, pod.rx, pod.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#11100f';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#d4a12a';
        ctx.stroke();
      });

      // Specular metallic highlights on gold ribs
      ctx.strokeStyle = 'rgba(255, 251, 224, 0.88)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(152, 262);
      ctx.bezierCurveTo(235, 218, 340, 232, 445, 282);
      ctx.stroke();
      ctx.restore();
    }

    export function drawGoldenSpiralArtwork(c) {
      if (!c) return;
      const ctx = c.getContext('2d');if(!ctx)return;
      const W = c.width, H = c.height;

      // 1. Warm Sunlit Gallery Wall Background
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#9d8258');
      bgGrad.addColorStop(0.52, '#d5c19d');
      bgGrad.addColorStop(1, '#ede1ca');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Sunlit window rectangles on right wall
      ctx.fillStyle = 'rgba(255, 249, 235, 0.45)';
      ctx.fillRect(515, 20, 82, 290);
      ctx.fillRect(620, 20, 80, 290);

      // 2. Veined Golden-Ochre Marble Pedestal Base
      const pedX = 168, pedY = 398, pedW = 384, pedH = 62;
      const pedGrad = ctx.createLinearGradient(pedX, pedY, pedX + pedW, pedY + pedH);
      pedGrad.addColorStop(0, '#c89e4c');
      pedGrad.addColorStop(0.45, '#9d7429');
      pedGrad.addColorStop(0.85, '#dfbe78');
      pedGrad.addColorStop(1, '#7a5718');
      ctx.fillStyle = pedGrad;
      ctx.fillRect(pedX, pedY, pedW, pedH);
      ctx.strokeStyle = '#f8e2a6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pedX, pedY, pedW, pedH);

      // Table surface below pedestal
      ctx.fillStyle = '#dfd4c0';
      ctx.fillRect(0, 456, W, 24);

      // 3. Fibonacci Golden Torus / Nautilus Sculpture
      const cx = 362, cy = 212;
      ctx.save();

      // Cast shadow on pedestal
      const castShadow = ctx.createRadialGradient(cx, 398, 10, cx, 398, 145);
      castShadow.addColorStop(0, 'rgba(42, 28, 6, 0.72)');
      castShadow.addColorStop(1, 'rgba(42, 28, 6, 0)');
      ctx.fillStyle = castShadow;
      ctx.beginPath();
      ctx.ellipse(cx, 398, 140, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw layered Fibonacci crescent shells revolving around the golden center
      const segments = 28;
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const angle = t * Math.PI * 3.15 - 0.6;
        const radius = 14 + Math.pow(t, 1.38) * 168;
        const sx = cx + Math.cos(angle) * (radius * 0.34);
        const sy = cy + Math.sin(angle) * (radius * 0.30);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        const segGrad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.25, radius * 0.08, 0, 0, radius);
        if (i % 3 === 0) {
          // Dark bronze/nero veined marble fold
          segGrad.addColorStop(0, '#f7d87c');
          segGrad.addColorStop(0.38, '#b5801e');
          segGrad.addColorStop(0.75, '#47320d');
          segGrad.addColorStop(1, '#261a05');
        } else {
          // Hammered 24K gold leaf fold
          segGrad.addColorStop(0, '#fff8d4');
          segGrad.addColorStop(0.32, '#f1c653');
          segGrad.addColorStop(0.70, '#bd8622');
          segGrad.addColorStop(1, '#6e4909');
        }

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 1.18);
        ctx.quadraticCurveTo(radius * 0.2, radius * 0.4, 0, 0);
        ctx.closePath();
        ctx.fillStyle = segGrad;
        ctx.fill();

        // Crisp golden kintsugi veins & hammered rim
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 246, 198, 0.82)' : 'rgba(120, 82, 14, 0.65)';
        ctx.stroke();
        ctx.restore();
      }

      // Inner glowing Fibonacci core spiral
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.08) {
        const r = 2.2 * Math.exp(0.24 * a);
        const px = cx - 28 + Math.cos(a) * r;
        const py = cy + 16 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#fff7cc';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.restore();
    }

    export function drawHiddenIdentityArtwork(c) {
      if (!c) return;
      const ctx = c.getContext('2d');if(!ctx)return;
      const W = c.width, H = c.height;

      // 1. Nero Marquina Black Marble Background with Gold Veins
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.65);
      bgGrad.addColorStop(0, '#221f1b');
      bgGrad.addColorStop(0.6, '#12110f');
      bgGrad.addColorStop(1, '#080706');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Gold kintsugi lightning veins across the dark stone background
      ctx.save();
      ctx.strokeStyle = 'rgba(218, 168, 52, 0.42)';
      ctx.lineWidth = 1.3;
      const bgVeins = [
        [[40, 20], [120, 140], [85, 290], [150, 460]],
        [[640, 10], [580, 160], [650, 310], [590, 470]],
        [[15, 220], [165, 260], [240, 390]],
        [[700, 190], [560, 240], [490, 380]]
      ];
      bgVeins.forEach(v => {
        ctx.beginPath();
        ctx.moveTo(v[0][0], v[0][1]);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i][0], v[i][1]);
        ctx.stroke();
      });
      ctx.restore();

      // 2. Hammered 24K Gold Sun Halo Disc Behind the Sculpted Head
      const haloX = 360, haloY = 206, haloR = 192;
      const haloGrad = ctx.createRadialGradient(haloX - 45, haloY - 45, 20, haloX, haloY, haloR);
      haloGrad.addColorStop(0, '#fff4bc');
      haloGrad.addColorStop(0.35, '#e8b944');
      haloGrad.addColorStop(0.75, '#b37e18');
      haloGrad.addColorStop(1, '#754e08');
      ctx.save();
      ctx.beginPath();
      ctx.arc(haloX, haloY, haloR, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fce394';
      ctx.stroke();

      // Radial geometric lines etched into the gold halo
      ctx.strokeStyle = 'rgba(92, 58, 6, 0.35)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(haloX + Math.cos(a) * 95, haloY + Math.sin(a) * 95);
        ctx.lineTo(haloX + Math.cos(a) * haloR, haloY + Math.sin(a) * haloR);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Sculpted Obsidian & Gold Geometric Face Bust (Three-Quarter Turn)
      ctx.save();
      // Neck & Shoulders
      ctx.beginPath();
      ctx.moveTo(225, 476);
      ctx.lineTo(285, 355);
      ctx.lineTo(395, 368);
      ctx.lineTo(445, 476);
      ctx.closePath();
      ctx.fillStyle = '#111010';
      ctx.fill();

      // Gold geometric armor plates on neck & shoulder
      const neckFacets = [
        [[245, 476], [285, 382], [342, 435], [310, 476]],
        [[348, 422], [392, 385], [418, 452], [365, 476]]
      ];
      neckFacets.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]);
        ctx.closePath();
        ctx.fillStyle = haloGrad;
        ctx.fill();
        ctx.strokeStyle = '#181510';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Cranium & Jaw Silhouette in Matte Obsidian
      ctx.beginPath();
      ctx.moveTo(265, 165);
      ctx.bezierCurveTo(265, 68, 415, 58, 455, 138); // Crown
      ctx.bezierCurveTo(474, 178, 476, 232, 458, 285); // Right cheek/temple
      ctx.bezierCurveTo(444, 332, 412, 368, 378, 372); // Chin
      ctx.bezierCurveTo(332, 368, 288, 325, 275, 265); // Left jaw
      ctx.closePath();

      const faceGrad = ctx.createLinearGradient(265, 80, 470, 370);
      faceGrad.addColorStop(0, '#2e2c29');
      faceGrad.addColorStop(0.5, '#151413');
      faceGrad.addColorStop(1, '#090909');
      ctx.fillStyle = faceGrad;
      ctx.fill();

      // Low-Poly 24K Gold Mask Facets across the Forehead, Temple & Cheek
      const goldMaskFacets = [
        [[278, 128], [348, 76], [362, 138], [292, 165]],
        [[348, 76], [422, 92], [395, 148], [362, 138]],
        [[270, 168], [326, 156], [338, 202], [266, 212]],
        [[266, 216], [336, 206], [358, 258], [295, 272]],
        [[295, 276], [356, 262], [338, 318], [282, 302]],
        [[438, 148], [468, 185], [456, 245], [425, 212]]
      ];
      goldMaskFacets.forEach((poly, idx) => {
        ctx.beginPath();
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0], poly[k][1]);
        ctx.closePath();
        ctx.fillStyle = idx % 2 === 0 ? '#eab940' : '#c89122';
        ctx.fill();
        ctx.strokeStyle = '#14120e';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      });

      // Sculpted Eyes, Nose Bridge & Lips in Obsidian with Specular Rim Light
      ctx.strokeStyle = 'rgba(255, 238, 185, 0.55)';
      ctx.lineWidth = 2;
      // Nose bridge & tip
      ctx.beginPath();
      ctx.moveTo(395, 182);
      ctx.lineTo(416, 256);
      ctx.lineTo(388, 268);
      ctx.stroke();

      // Eyes (serene closed/half-lidded)
      ctx.beginPath();
      ctx.arc(356, 198, 18, 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(432, 202, 14, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // Sculpted lips highlight
      ctx.beginPath();
      ctx.moveTo(366, 304);
      ctx.quadraticCurveTo(395, 294, 418, 305);
      ctx.quadraticCurveTo(395, 322, 366, 304);
      ctx.fillStyle = '#292623';
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

