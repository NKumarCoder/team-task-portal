'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorations matching the theme */}
      <div className="bg-glow-purple -top-40 -left-40" />
      <div className="bg-glow-blue -bottom-40 -right-40" />
      
      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-2">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Apex Task Portal</h2>
        <p className="text-sm text-muted-foreground">Redirecting to your workspace...</p>
      </div>
    </div>
  );
}
