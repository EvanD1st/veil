// Supplied ivory citadel/ribbon painting, static and bounded. Decorative only.
export function paintAuthBackdrop(canvas){
if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    function drawGoldOrb(ctx, x, y, r) {
      ctx.save();
      // Warm glow halo
      const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
      halo.addColorStop(0, 'rgba(255, 232, 145, 0.75)');
      halo.addColorStop(1, 'rgba(255, 232, 145, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // 3D metallic sphere
      const sphere = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      sphere.addColorStop(0, '#fff9db');
      sphere.addColorStop(0.35, '#f0c44d');
      sphere.addColorStop(0.78, '#b57b14');
      sphere.addColorStop(1, '#784c05');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawCitadelSpireCluster(ctx, baseX, baseY, width, height, shadeAlpha) {
      ctx.save();
      const grad = ctx.createLinearGradient(baseX, baseY - height, baseX + width, baseY);
      grad.addColorStop(0, `rgba(235, 224, 203, ${shadeAlpha})`);
      grad.addColorStop(0.5, `rgba(216, 201, 175, ${shadeAlpha})`);
      grad.addColorStop(1, `rgba(244, 236, 220, ${shadeAlpha * 0.4})`);
      ctx.fillStyle = grad;

      // Stepped classical monoliths
      const cols = 7;
      const colW = width / cols;
      for (let i = 0; i < cols; i++) {
        const distFromCenter = Math.abs(i - (cols - 1) / 2) / (cols / 2);
        const h = height * (1 - distFromCenter * 0.52) * (0.85 + Math.sin(i * 2.3) * 0.15);
        const x = baseX + i * colW;
        const y = baseY - h;
        ctx.fillRect(x, y, colW * 0.92, h);

        // Sunlit left highlight edge
        ctx.fillStyle = `rgba(255, 250, 236, ${shadeAlpha * 0.65})`;
        ctx.fillRect(x, y, 2.2, h * 0.85);
        ctx.fillStyle = grad;
      }
      ctx.restore();
    }

    function drawAtmosphericScene() {
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth<800?1:1.5);
      const W = 1280;
      const H = 800;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Warm Ivory & Sunlit Champagne Sky Backdrop
      const skyGrad = ctx.createLinearGradient(0, 0, W, H);
      skyGrad.addColorStop(0.0, '#fbf8f1');
      skyGrad.addColorStop(0.35, '#f6efe0');
      skyGrad.addColorStop(0.70, '#eadcc4');
      skyGrad.addColorStop(1.0, '#dec9a6');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Golden valley sun bloom in center-left background
      const valleyBloom = ctx.createRadialGradient(W * 0.36, H * 0.56, 20, W * 0.38, H * 0.56, W * 0.46);
      valleyBloom.addColorStop(0, 'rgba(255, 236, 175, 0.85)');
      valleyBloom.addColorStop(0.45, 'rgba(248, 224, 162, 0.38)');
      valleyBloom.addColorStop(1, 'rgba(248, 224, 162, 0)');
      ctx.fillStyle = valleyBloom;
      ctx.fillRect(0, 0, W, H);

      // 2. Distant Sunlit Alabaster Citadel Spires & Viaduct Archway
      drawCitadelSpireCluster(ctx, 438, 430, 122, 395, 0.78);
      ctx.fillStyle = 'rgba(226, 212, 188, 0.82)';
      ctx.beginPath();
      ctx.moveTo(498, 12);
      ctx.lineTo(506, 65);
      ctx.lineTo(490, 65);
      ctx.closePath();
      ctx.fill();

      // Secondary citadel cluster to the right of the bridge
      drawCitadelSpireCluster(ctx, 598, 440, 86, 270, 0.72);

      // Classical Stone Viaduct Archway connecting the two clusters
      ctx.save();
      ctx.fillStyle = 'rgba(218, 204, 180, 0.68)';
      ctx.beginPath();
      ctx.rect(545, 252, 65, 130);
      ctx.fill();
      ctx.fillStyle = '#f4ead6';
      ctx.beginPath();
      ctx.arc(577, 318, 18, Math.PI, 0, false);
      ctx.lineTo(595, 382);
      ctx.lineTo(559, 382);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Midground sunlit citadel towers below the archway
      drawCitadelSpireCluster(ctx, 545, 575, 165, 225, 0.76);

      // Massive upper-right limestone cliff & temple facade behind the glass card
      drawCitadelSpireCluster(ctx, 825, 420, 430, 420, 0.74);

      // 3. Volumetric Golden-Ivory Clouds & Mist Layers
      const cloudPositions = [
        { x: 240, y: 120, rx: 240, ry: 75, alpha: 0.65 },
        { x: 460, y: 425, rx: 220, ry: 68, alpha: 0.78 },
        { x: 640, y: 690, rx: 320, ry: 95, alpha: 0.82 },
        { x: 1050, y: 680, rx: 290, ry: 90, alpha: 0.75 },
        { x: 310, y: 615, rx: 210, ry: 65, alpha: 0.72 }
      ];
      cloudPositions.forEach(c => {
        const cg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.rx);
        cg.addColorStop(0, `rgba(255, 251, 242, ${c.alpha})`);
        cg.addColorStop(0.55, `rgba(245, 235, 216, ${c.alpha * 0.55})`);
        cg.addColorStop(1, 'rgba(245, 235, 216, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Swirling Liquid-Crystal & Gold Ribbons
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(715, -10);
      ctx.bezierCurveTo(775, 145, 955, 145, 1095, -15);
      ctx.lineWidth = 42;
      ctx.strokeStyle = 'rgba(255, 250, 236, 0.52)';
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(232, 184, 62, 0.85)';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(1290, 20);
      ctx.bezierCurveTo(1180, 140, 1175, 265, 1290, 360);
      ctx.lineWidth = 48;
      ctx.strokeStyle = 'rgba(255, 250, 236, 0.48)';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(232, 184, 62, 0.8)';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-20, 430);
      ctx.bezierCurveTo(140, 510, 395, 555, 555, 700);
      ctx.bezierCurveTo(635, 770, 710, 800, 790, 810);
      ctx.lineWidth = 56;
      ctx.strokeStyle = 'rgba(255, 251, 240, 0.50)';
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(230, 180, 52, 0.85)';
      ctx.stroke();
      ctx.restore();

      // 5. Delicate Golden Constellation Filaments & Metallic Orbs
      ctx.save();
      ctx.strokeStyle = 'rgba(218, 168, 42, 0.72)';
      ctx.lineWidth = 1.3;

      ctx.beginPath();
      ctx.moveTo(580, 120);
      ctx.bezierCurveTo(640, 235, 860, 240, 1190, -10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(410, 650);
      ctx.bezierCurveTo(510, 610, 630, 645, 740, 725);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-10, 590);
      ctx.bezierCurveTo(85, 625, 140, 675, 210, 710);
      ctx.stroke();

      const orbs = [
        { x: 615, y: 213, r: 5.5 },
        { x: 1128, y: 36, r: 9.5 },
        { x: 1015, y: 122, r: 5.5 },
        { x: 528, y: 632, r: 5.5 },
        { x: 575, y: 677, r: 5.0 },
        { x: 726, y: 782, r: 6.5 },
        { x: 24, y: 608, r: 5.0 },
        { x: 48, y: 707, r: 8.5 }
      ];
      orbs.forEach(o => drawGoldOrb(ctx, o.x, o.y, o.r));
      ctx.restore();

      // 6. Sunlit Foreground Travertine / Limestone Crags (Bottom-Left)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 625);
      ctx.lineTo(68, 608);
      ctx.lineTo(135, 632);
      ctx.lineTo(215, 668);
      ctx.lineTo(310, 662);
      ctx.lineTo(382, 684);
      ctx.lineTo(445, 675);
      ctx.lineTo(505, 708);
      ctx.lineTo(548, 702);
      ctx.lineTo(598, 765);
      ctx.lineTo(625, 800);
      ctx.lineTo(0, 800);
      ctx.closePath();

      const rockGrad = ctx.createLinearGradient(0, 610, 580, 800);
      rockGrad.addColorStop(0, '#e8dac1');
      rockGrad.addColorStop(0.45, '#cbb48c');
      rockGrad.addColorStop(0.8, '#9e8156');
      rockGrad.addColorStop(1, '#7a5f38');
      ctx.fillStyle = rockGrad;
      ctx.fill();

      const facets = [
        [[20, 640], [95, 622], [148, 658], [62, 675]],
        [[155, 665], [245, 672], [295, 712], [185, 708]],
        [[280, 682], [375, 688], [412, 738], [315, 732]],
        [[415, 705], [502, 710], [545, 765], [448, 768]]
      ];
      facets.forEach((poly, i) => {
        ctx.beginPath();
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0], poly[k][1]);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 232, 0.45)' : 'rgba(110, 82, 42, 0.35)';
        ctx.fill();
      });

      const fgDome = ctx.createRadialGradient(145, 795, 15, 145, 795, 165);
      fgDome.addColorStop(0, 'rgba(255, 248, 228, 0.55)');
      fgDome.addColorStop(0.7, 'rgba(235, 198, 105, 0.32)');
      fgDome.addColorStop(1, 'rgba(235, 198, 105, 0)');
      ctx.fillStyle = fgDome;
      ctx.beginPath();
      ctx.arc(145, 795, 165, Math.PI, 0, false);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }


drawAtmosphericScene();
}
