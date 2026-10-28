import {readFile} from 'node:fs/promises';
export function availableBytes(meminfo){const match=meminfo.match(/^MemAvailable:\s+(\d+) kB$/m);if(!match)throw Error('Native Linux memory observation required.');return Number(match[1])*1024;}
export async function memoryAvailable(){return availableBytes(await readFile('/proc/meminfo','utf8'));}
// Even the lowest assessed setting leaves 1.25 GiB outside the worker's
// 1536 MiB cgroup cap, above its independent 1 GiB emergency browser guard.
export function proofMinimumBytes(minimumMiB=3072){if(!Number.isSafeInteger(minimumMiB)||minimumMiB<2816||minimumMiB>3072)throw Error('Proof admission must retain 2816–3072 MiB.');return minimumMiB*1024**2;}
export async function admitProof(minimumMiB=3072){if(await memoryAvailable()<proofMinimumBytes(minimumMiB))throw Error('Proof admission paused: retain assessed memory headroom before a job.');}
