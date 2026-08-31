import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook para melhorar acessibilidade global da aplicação.
 * Usa React Router location em vez de manipulação direta do DOM.
 */
export function useAccessibility() {
  const location = useLocation();

  useEffect(() => {
    // Add navigation aria-label to sidebar if missing
    const sidebar = document.querySelector('aside');
    if (sidebar && !sidebar.hasAttribute('aria-label')) {
      sidebar.setAttribute('aria-label', 'Menu lateral de navegação');
    }

    // Add aria-label to main landmark if missing
    const main = document.getElementById('main-content');
    if (main && !main.hasAttribute('aria-label')) {
      main.setAttribute('aria-label', 'Conteúdo principal');
    }

    // Ensure all buttons have descriptive labels
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      if (!btn.textContent?.trim() && btn.querySelector('svg')) {
        const svg = btn.querySelector('svg');
        const title = svg?.getAttribute('title') || 'Botão de ação';
        btn.setAttribute('aria-label', title);
      }
    });

    // Ensure all images have alt text
    document.querySelectorAll('img:not([alt])').forEach(img => {
      img.setAttribute('alt', '');
      img.setAttribute('role', 'presentation');
    });
  }, [location.pathname]);

  // Update aria-current on route change via React Router
  useEffect(() => {
    const currentPath = location.pathname;
    document.querySelectorAll('nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }, [location.pathname]);
}

/**
 * Hook para anúncios de screen reader
 */
export function useAnnounce() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('sr-announcer') || createAnnouncer();
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }, []);

  return { announce };
}

function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.id = 'sr-announcer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  document.body.appendChild(announcer);
  return announcer;
}

/**
 * Componente Skip Link para navegação por teclado
 */
export function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a 
      href="#main-content" 
      className="skip-link"
      onClick={handleClick}
    >
      Pular para o conteúdo principal
    </a>
  );
}

/**
 * Hook for detecting keyboard vs mouse user
 */
export function useInputMethod() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-user');
        document.body.classList.remove('mouse-user');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.add('mouse-user');
      document.body.classList.remove('keyboard-user');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
}
