process.env.VEIL_LOCAL_TEST='1';
process.argv=[process.execPath,'scripts/run-framework.mjs','dev','--host','127.0.0.1','--port','5174'];
await import('./run-framework.mjs');
