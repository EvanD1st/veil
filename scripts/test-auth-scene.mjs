import {authPage,sendPage} from '../runtime/auth-pages.mjs';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const server=createServer((req,res)=>sendPage(res,200,authPage(req.url.includes('signup')?'signup':'login','/')));
await new Promise(r=>server.listen(5199,'127.0.0.1',r));let browser;
try{
 await mkdir('outputs/auth-scene',{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.VEIL_BROWSER_CHANNEL?{channel:process.env.VEIL_BROWSER_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/login');await page.locator('.scene-envelope').last().waitFor();
 assert.equal(await page.locator('.scene-envelope').count(),14);
 const envelope=page.locator('.scene-envelope').first(),before=await envelope.getAttribute('transform');
 await page.mouse.move(200,550);await page.waitForTimeout(300);assert.notEqual(await envelope.getAttribute('transform'),before);
 await page.screenshot({path:'outputs/auth-scene/login-desktop.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const still=await envelope.getAttribute('transform');await page.waitForTimeout(200);assert.equal(await envelope.getAttribute('transform'),still);
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5199/signup');await page.locator('.scene-envelope').first().waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('.scene-envelope:visible').count(),4);
 await page.getByLabel('Password',{exact:true}).fill('a-long-test-password');await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');await page.getByLabel('Password',{exact:true}).fill('');
 await page.screenshot({path:'outputs/auth-scene/signup-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 assert.equal(await page.locator('script[src],link[href^="https:"]').count(),0);
 console.log('PASS supplied SVG scene under production CSP: 14 envelopes, motion, static reduced motion, four mobile envelopes, no overflow, password controls and no external dependencies. Browser emulation only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}