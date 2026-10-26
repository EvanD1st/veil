import {authPage,sendPage} from '../runtime/auth-pages.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{if(/^\/fonts\/(inter|playfair-display)-(regular|semibold)\.ttf$/.test(req.url)){res.writeHead(200,{'Content-Type':'font/ttf'});res.end(await readFile('public'+req.url));return;}sendPage(res,200,authPage(req.url.includes('signup')?'signup':'login','/'));});
await new Promise(r=>server.listen(5199,'127.0.0.1',r));let browser;
try{
 await mkdir('outputs/auth-scene',{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.VEIL_BROWSER_CHANNEL?{channel:process.env.VEIL_BROWSER_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/login');await page.locator('.scene-envelope').last().waitFor();
 await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.fonts.check('16px "Playfair Display"')&&document.fonts.check('14px Inter')),true);
 assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
 assert.equal(await page.locator('#authScenery').evaluate(c=>c.width>0&&c.height>0),true);
 assert.ok((await page.locator('.scene-envelope use').first().getAttribute('href')).includes('FrontV'));
 assert.equal(await page.locator('.scene-envelope').count(),14);
 const envelope=page.locator('.scene-envelope').first(),before=await envelope.getAttribute('transform');
 await page.mouse.move(200,550);await page.waitForTimeout(300);assert.notEqual(await envelope.getAttribute('transform'),before);
 await page.screenshot({path:'outputs/auth-scene/login-desktop.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const still=await envelope.getAttribute('transform');await page.waitForTimeout(200);assert.equal(await envelope.getAttribute('transform'),still);
 for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:600}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true,`Login must fit ${viewport.width}x${viewport.height}`);const box=await page.getByRole('link',{name:'Create account',exact:true}).boundingBox();assert.ok(box&&box.y+box.height<=viewport.height);}
 await page.goto('http://127.0.0.1:5199/signup');for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:600}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true,`Signup must fit ${viewport.width}x${viewport.height}`);const box=await page.getByRole('button',{name:'Create account',exact:true}).boundingBox();assert.ok(box&&box.y+box.height<=viewport.height);}
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5199/signup');await page.locator('.scene-envelope').first().waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('.scene-envelope:visible').count(),4);
 await page.getByLabel('Password',{exact:true}).fill('a-long-test-password');await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');await page.getByLabel('Password',{exact:true}).fill('');
 await page.screenshot({path:'outputs/auth-scene/signup-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 assert.equal(await page.locator('script[src],link[href^="https:"]').count(),0);
 console.log('PASS supplied SVG scene under production CSP: 14 envelopes, motion, static reduced motion, four mobile envelopes, no overflow, password controls and no external dependencies. Browser emulation only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
