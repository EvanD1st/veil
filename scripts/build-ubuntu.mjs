process.env.VEIL_DEPLOY_TARGET='node';
process.argv=[process.execPath,new URL('../node_modules/vinext/dist/cli.js',import.meta.url).pathname,'build'];
await import('../node_modules/vinext/dist/cli.js');
