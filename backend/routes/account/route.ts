import { getChatGPTUser } from '@/backend/auth/chatgpt-auth';
import { chatGPTSignOutPath } from '@/backend/auth/chatgpt-auth';
import { ApiError, handle, json } from '@/backend/veil/server';
export const dynamic = 'force-dynamic';
export async function GET() { return handle(async () => { const user = await getChatGPTUser(); if (!user) throw new ApiError('Authentication required.', 401); return json({username:user.displayName,logoutPath:chatGPTSignOutPath('/')}); }); }
