'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';

interface Language {
  code: 'ja' | 'en';
  name: string;
  englishName: string;
  flag: string;
  voice: {
    male: string;
    female: string;
    default: string;
  };
}

interface LanguageSelectorProps {
  currentLanguage?: 'ja' | 'en';
  onLanguageChange?: (language: 'ja' | 'en') => void;
  showFlags?: boolean;
  showDropdown?: boolean;
  disabled?: boolean;
}

export default function LanguageSelector({
  currentLanguage = 'ja',
  onLanguageChange,
  showFlags = true,
  showDropdown = true,
  disabled = false
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<'ja' | 'en'>(currentLanguage);
  const [error, setError] = useState<string | null>(null);

  // Load available languages
  useEffect(() => {
    loadLanguages();
  }, []);

  // Update selected language when prop changes
  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  const loadLanguages = async () => {
    try {
      const response = await fetch('/api/voice?action=supported_languages');
      const result = await response.json();

      if (result.success && result.result) {
        const languageData = result.result.details;
        const supportedLanguages = result.result.supported;

        const languageList: Language[] = supportedLanguages.map((code: string) => ({
          code,
          ...languageData[code],
        }));

        setLanguages(languageList);
      } else {
        // Fallback to default languages
        setLanguages([
          {
            code: 'ja',
            name: '日本語',
            englishName: 'Japanese',
            flag: '🇯🇵',
            voice: {
              male: 'ja-JP-Neural2-C',
              female: 'ja-JP-Neural2-B',
              default: 'ja-JP-Neural2-B',
            },
          },
          {
            code: 'en',
            name: 'English',
            englishName: 'English',
            flag: '🇺🇸',
            voice: {
              male: 'en-US-Neural2-D',
              female: 'en-US-Neural2-F',
              default: 'en-US-Neural2-F',
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
      setError('Failed to load languages');
    }
  };

  const handleLanguageChange = async (language: 'ja' | 'en') => {
    if (language === selectedLanguage || disabled || isChanging) return;

    try {
      setIsChanging(true);
      setError(null);

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_language',
          language,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSelectedLanguage(language);
        onLanguageChange?.(language);
        setIsOpen(false);

        // Show success message briefly
        setTimeout(() => setIsChanging(false), 500);
      } else {
        setError(result.error || 'Failed to change language');
        setIsChanging(false);
      }
    } catch (error) {
      console.error('Error changing language:', error);
      setError('Error changing language');
      setIsChanging(false);
    }
  };

  const getCurrentLanguage = () => {
    return languages.find(lang => lang.code === selectedLanguage);
  };

  const currentLang = getCurrentLanguage();

  if (showDropdown) {
    return (
      <div className="relative">
        {/* Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isChanging}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
            disabled || isChanging
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700'
          } ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        >
          {isChanging ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showFlags && currentLang ? (
            <span className="text-lg">{currentLang.flag}</span>
          ) : (
            <Globe className="w-4 h-4" />
          )}
          
          <span className="text-sm font-medium">
            {currentLang ? currentLang.name : 'Language'}
          </span>
          
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 py-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                disabled={isChanging}
                className={`w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                  selectedLanguage === language.code
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700'
                } ${isChanging ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {showFlags && (
                  <span className="text-lg">{language.flag}</span>
                )}
                
                <div className="flex-1">
                  <div className="font-medium">{language.name}</div>
                  <div className="text-xs text-gray-500">{language.englishName}</div>
                </div>
                
                {selectedLanguage === language.code && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md shadow-sm z-50">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Toggle button style (not dropdown)
  return (
    <div className="flex items-center space-x-2">
      {languages.map((language) => (
        <button
          key={language.code}
          onClick={() => handleLanguageChange(language.code)}
          disabled={disabled || isChanging}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
            selectedLanguage === language.code
              ? 'bg-blue-500 text-white shadow-md'
              : disabled || isChanging
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'
          }`}
        >
          {isChanging && selectedLanguage === language.code ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showFlags ? (
            <span className="text-lg">{language.flag}</span>
          ) : (
            <Globe className="w-4 h-4" />
          )}
          
          <span className="text-sm font-medium">{language.name}</span>
          
          {selectedLanguage === language.code && !isChanging && (
            <Check className="w-4 h-4" />
          )}
        </button>
      ))}

      {error && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md shadow-sm z-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
