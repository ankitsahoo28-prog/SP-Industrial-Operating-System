import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sp-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.style.setProperty('--primary', '#818cf8');
      root.style.setProperty('--primary-foreground', '#FFFFFF');
      localStorage.setItem('sp-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--primary', '#0F172A');
      root.style.setProperty('--primary-foreground', '#FFFFFF');
      localStorage.setItem('sp-theme', 'light');
    }
  }, [dark]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="p-2"
      onClick={() => setDark(d => !d)}
      data-testid="theme-toggle"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-muted-foreground" />}
    </Button>
  );
}
