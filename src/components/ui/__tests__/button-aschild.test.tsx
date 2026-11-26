import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// `asChild` delega a renderização ao filho através do Slot do Radix. O app usa
// isso para envolver Link, TooltipTrigger e afins, então o contrato aqui é o que
// garante que trocar a versão do Slot não some com classe, handler ou ref.
describe('Button asChild', () => {
  it('mantém as classes do filho junto das do Button', () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <Link to="/settings/uapi" className="custom-cls">
            Configurar
          </Link>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Configurar' });
    expect(link.className).toContain('custom-cls');
    expect(link.className).toContain('inline-flex');
  });

  it('executa o handler do Button e o do filho', () => {
    const onButtonClick = vi.fn();
    const onLinkClick = vi.fn();

    render(
      <MemoryRouter>
        <Button asChild onClick={onButtonClick}>
          <a href="/destino" onClick={onLinkClick}>
            Ir
          </a>
        </Button>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Ir' }));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });

  it('entrega o ref no elemento renderizado, não no Slot', () => {
    const ref = createRef<HTMLAnchorElement>();

    render(
      <MemoryRouter>
        <Button asChild ref={ref as never}>
          <a href="/destino">Foco</a>
        </Button>
      </MemoryRouter>,
    );

    expect(ref.current).toBe(screen.getByRole('link', { name: 'Foco' }));
  });

  it('preserva o aria-describedby que o filho já tinha', () => {
    render(
      <MemoryRouter>
        <Button asChild aria-describedby="do-botao">
          <a href="/destino" aria-describedby="do-link">
            Descrito
          </a>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Descrito' });
    expect(link.getAttribute('aria-describedby')?.split(' ').sort()).toEqual(['do-botao', 'do-link']);
  });
});
