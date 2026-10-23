import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:180000,
 expect:{timeout:20000},retries:0,
 outputDir:'.sites-runtime/e2e/results',
 reporter:[['list'],['json',{outputFile:'.sites-runtime/e2e/results.json'}]],
 use:{actionTimeout:20000,baseURL:'http://127.0.0.1:5174',browserName:'chromium',channel:process.env.CI||process.platform!=='win32'?undefined:'chrome',headless:true,trace:'off',screenshot:'only-on-failure',acceptDownloads:true},
 webServer:{command:'node scripts/e2e-server.mjs',url:'http://127.0.0.1:5174',reuseExistingServer:false,timeout:120000},
});
