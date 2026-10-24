import EscrowOrder from '@/app/escrow-order';
export default async function Page({params}:{params:Promise<{id:string}>}){return <main className="page-content"><EscrowOrder id={(await params).id}/></main>;}
