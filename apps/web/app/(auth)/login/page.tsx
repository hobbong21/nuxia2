'use client';

import * as React from 'react';
import Link from 'next/link';
import { Header } from '@/components/commerce/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: api.post('/auth/login', { email, password }, AuthResponseSchema)
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="로그인" showBack />
      <main className="px-base pt-lg pb-base">
        <form onSubmit={onSubmit} className="space-y-md max-w-md mx-auto">
          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">이메일</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">비밀번호</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit" variant="accent" size="lg" block loading={loading}>
            로그인
          </Button>
          <div className="flex items-center justify-between pt-sm text-body-sm">
            <Link href="/signup" className="text-accent">회원가입</Link>
            <Link href="/forgot" className="text-muted-foreground">비밀번호 찾기</Link>
          </div>
        </form>
      </main>
    </>
  );
}
