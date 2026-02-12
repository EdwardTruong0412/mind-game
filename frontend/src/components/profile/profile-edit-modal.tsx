'use client';

/**
 * Profile Edit Modal
 * Modal for editing user profile (display name, avatar)
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const { user, updateProfile } = useAuth();
  const { t, language } = useLanguage();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError(language === 'vi' ? 'Tên hiển thị không được để trống' : 'Display name is required');
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-bold mb-4">
          {language === 'vi' ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-2">
              {t('displayName')}
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('displayNamePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="avatarUrl" className="block text-sm font-medium mb-2">
              {language === 'vi' ? 'URL ảnh đại diện' : 'Avatar URL'}
            </label>
            <input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/avatar.jpg"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {language === 'vi' ? 'Tùy chọn' : 'Optional'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading
                ? language === 'vi'
                  ? 'Đang lưu...'
                  : 'Saving...'
                : language === 'vi'
                ? 'Lưu'
                : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
