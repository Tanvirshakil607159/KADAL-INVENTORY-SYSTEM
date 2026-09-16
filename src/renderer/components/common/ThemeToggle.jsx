import React from 'react';
import { Moon, Sun } from 'lucide-react';
import useStore from '../../store/useStore';

export default function ThemeToggle({ className = '' }) {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);
  const isLight = theme === 'light';
  const label = `Switch to ${isLight ? 'Dark' : 'Light'} Mode`;

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      aria-label={label}
      title={label}
    >
      {isLight ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      <span>{isLight ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
