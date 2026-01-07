'use client'

// components/LanguageSelector.tsx
// Language selector dropdown component

import { useLanguage } from '@/lib/language-context'
import { Language } from '@/lib/translations'

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded text-sm font-medium transition ${
          language === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('fr')}
        className={`px-3 py-1 rounded text-sm font-medium transition ${
          language === 'fr'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        FR
      </button>
    </div>
  )
}
