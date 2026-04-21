'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-base px-base text-center">
      <h1 className="text-h2">문제가 발생했습니다</h1>
      <p className="text-body text-muted-foreground">{error.message}</p>
      <Button variant="accent" size="lg" onClick={() => reset()}>
        다시 시도
      </Button>
    </main>
  );
}
