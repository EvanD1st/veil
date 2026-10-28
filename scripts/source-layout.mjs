// Source organization is separate from the stable generated deployment/test layout.
import layout from './source-layout.json' with {type:'json'};
import {posix} from 'node:path';
export function sourcePath(legacy){if(layout.special[legacy])return layout.special[legacy];for(const[a,b]of layout.prefixes)if(legacy.startsWith(a))return b+legacy.slice(a.length);return legacy;}
export function legacyPath(source){for(const[a,b]of Object.entries(layout.special))if(source===b)return a;for(const[a,b]of layout.prefixes)if(source.startsWith(b))return a+source.slice(b.length);return source;}
// Rebase source-local imports when emitting the established flat release/test modules.
export function legacyModule(text,source){const output=legacyPath(source);return text.replace(/(['"])(@\/[^'"\n]+|\.\.?\/[^'"\n]+)\1/g,(whole,quote,spec)=>{
 const alias=spec.startsWith('@/'),target=alias?spec.slice(2):posix.normalize(posix.join(posix.dirname(source),spec));
 let original=legacyPath(target);
 if(original===target){for(const extension of ['.ts','.tsx','.mjs','.mts','.js','.json']){const mapped=legacyPath(target+extension);if(mapped!==target+extension){original=mapped.slice(0,-extension.length);break;}}}
 if(original===target)return whole;
 let result=alias?'@/'+original:posix.relative(posix.dirname(output)||'.',original);if(!alias&&!result.startsWith('.'))result='./'+result;return quote+result+quote;
});}
