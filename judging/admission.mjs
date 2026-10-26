import {readFile} from 'node:fs/promises';
export function availableBytes(meminfo){const match=meminfo.match(/^MemAvailable:\s+(\d+) kB$/m);if(!match)throw Error('Native Linux memory observation required.');return Number(match[1])*1024;}
export async function memoryAvailable(){return availableBytes(await readFile('/proc/meminfo','utf8'));}
export async function admitProof(){if(await memoryAvailable()<3*1024**3)throw Error('Proof admission paused: retain at least 3 GiB available before a job.');}
