// Ordinary hosted guided demo; real future drand, no clock/request interception.
// Guided bidders are simulated. This checks cancellation, not a persisted auction/payment.
import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(process.env.VEIL_HOSTED_TEST_CONFIG,'utf8'));
if(new URL(config.origin).protocol!=='https:')throw Error('HTTPS required.');
const browser=await chromium.launch({headless:true,...(process.env.VEIL_BROWSER_CHANNEL?{channel:process.env.VEIL_BROWSER_CHANNEL}:{})});
try{
 const context=await browser.newContext({baseURL:config.origin}),page=await context.newPage(),account=config.accounts.seller;
 await page.goto('/signin-with-chatgpt');await page.getByLabel('Username').fill(account.username);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:/^(Log in|Sign in)$/,exact:true}).click();
 await expect(page.locator('main[data-hydrated="true"]')).toBeVisible({timeout:90000});
 await page.getByRole('button',{name:'Try a sealed auction',exact:true}).click();await page.getByRole('button',{name:'Seal my bid',exact:true}).click();
 const open=page.getByRole('button',{name:'Open as seller'});await expect(open).toBeEnabled({timeout:90000});
 for(let attempt=0;attempt<2;attempt++){
  await open.click();await expect(page.getByRole('button',{name:'Cancel proof'})).toBeVisible({timeout:30000});
  await expect(page.locator('[aria-live="polite"] p')).toContainText(/proof assets|private witness|accepted bid/i,{timeout:60000});
  await page.getByRole('button',{name:'Cancel proof'}).click();await expect(open).toBeEnabled();
  await expect(page.getByText('Your offer won.',{exact:true})).toHaveCount(0);await expect(page.getByRole('status')).toContainText('cancelled');
 }
 await page.goto('/signout-with-chatgpt');await page.getByRole('button',{name:/^(Log out|Sign out)$/,exact:true}).click();
 console.log('PASS hosted real-worker download progress, cancellation, retry and cancellation recovery with ordinary clocks/live drand. Guided bidders; no publication or payment evidence.');
}catch{console.error('Hosted cancellation check incomplete; no success or payment claimed.');process.exitCode=1;}
finally{await browser.close();}
