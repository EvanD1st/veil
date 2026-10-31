import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { nodeDatabase } from './database.mjs';
import { sessionUser, safeReturn } from './accounts.mjs';
export async function getChatGPTUser(){return sessionUser(nodeDatabase(),(await headers()).get('cookie')??'');}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath(returnTo));return user;}
export function chatGPTSignInPath(returnTo='/'){return '/login?return_to='+encodeURIComponent(safeReturn(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/logout';}
