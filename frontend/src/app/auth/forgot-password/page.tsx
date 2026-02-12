'use client';

/**
 * Forgot Password Page
 * Request password reset code
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.error.required_fields'));
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSuccess(true);
      // Redirect to reset page after 3 seconds
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.forgot_password_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Schulte Table
              </h1>
            </Link>
            <h2 className="text-xl font-semibold mb-2">{t('auth.forgot_password')}</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('auth.forgot_password_description')}
            </p>
          </div>

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
              <p className="text-green-600 dark:text-green-400 mb-2">
                {t('auth.reset_code_sent')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('auth.check_email')}
              </p>
            </div>
          ) : (
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
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? t('auth.sending') : t('auth.send_reset_code')}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/auth/login" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
