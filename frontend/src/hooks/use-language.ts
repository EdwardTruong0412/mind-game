'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { type Language, type TranslationKey, getTranslation } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback for when used outside provider
    const [language, setLanguageState] = useState<Language>('en');

    useEffect(() => {
      const saved = localStorage.getItem('language') as Language;
      if (saved && (saved === 'en' || saved === 'vi')) {
        setLanguageState(saved);
      }
    }, []);

    const setLanguage = useCallback((lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('language', lang);
    }, []);

    const t = useCallback((key: TranslationKey) => {
      return getTranslation(language, key);
    }, [language]);

    return { language, setLanguage, t };
  }
  return context;
}

// Simple hook that works without provider
export function useTranslation() {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'vi')) {
      setLanguageState(saved);
    }
    setIsLoaded(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return getTranslation(language, key);
  }, [language]);

  return { language, setLanguage, t, isLoaded };
}
