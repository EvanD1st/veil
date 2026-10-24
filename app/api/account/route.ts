import { getChatGPTUser } from '@/app/chatgpt-auth';
import { chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { ApiError, handle, json } from '@/lib/veil/server';
export const dynamic = 'force-dynamic';
export async function GET() { return handle(async () => { const user = await getChatGPTUser(); if (!user) throw new ApiError('Authentication required.', 401); return json({username:user.displayName,logoutPath:chatGPTSignOutPath('/')}); }); }
