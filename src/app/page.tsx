import { AppProvider } from '@/components/AppProvider';
import { Shell } from '@/components/Shell';
import { PwaRegister } from '@/components/PwaRegister';

export default function Page() {
  return (
    <AppProvider>
      <Shell />
      <PwaRegister />
    </AppProvider>
  );
}
