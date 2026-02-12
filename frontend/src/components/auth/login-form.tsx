'use client';

/**
 * Login Form Component
 * Reusable login form with validation and error handling
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function LoginForm() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.error.required_fields'));
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/'); // Redirect to home after successful login
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          {t('auth.email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('auth.email_placeholder')}
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          {t('auth.password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('auth.password_placeholder')}
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? t('auth.logging_in') : t('auth.login')}
      </Button>

      <div className="text-center space-y-2">
        <Link
          href="/auth/forgot-password"
          className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('auth.forgot_password')}
        </Link>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('auth.no_account')}{' '}
          <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </form>
  );
}
