import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-base px-base text-center">
      <h1 className="text-h2">페이지를 찾을 수 없습니다</h1>
      <p className="text-body text-muted-foreground">
        입력하신 주소가 변경되었거나 삭제되었습니다.
      </p>
      <Button asChild variant="accent" size="lg">
        <Link href="/">홈으로 이동</Link>
      </Button>
    </main>
  );
}
