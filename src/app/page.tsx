import { redirect } from 'next/navigation';
import { AppProvider } from '@/components/AppProvider';
import { Shell } from '@/components/Shell';
import { PwaRegister } from '@/components/PwaRegister';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic'; // per-user, never statically cached

export default async function Page() {
  const user = await getUser();
  if (!user) redirect('/login');
  return (
    <AppProvider user={user}>
      <Shell />
      <PwaRegister />
    </AppProvider>
  );
}
