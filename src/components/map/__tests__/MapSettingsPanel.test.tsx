import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MapSettingsPanel } from '../MapSettingsPanel';
import { useMapSettings } from '@/hooks/useMapSettings';
import { toast } from 'sonner';
import { createElement } from 'react';

// Mock ResizeObserver for Radix components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the Slider component to avoid ResizeObserver and complex interactions
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ onValueChange, value, min, max }: any) => 
    createElement('input', {
      type: 'range',
      min,
      max,
      value: value[0],
      'data-testid': 'mock-slider',
      onChange: (e: any) => onValueChange([parseInt(e.target.value, 10)])
    })
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => createElement('div', props, children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock the hook
vi.mock('@/hooks/useMapSettings', () => ({
  useMapSettings: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MapSettingsPanel Integration', () => {
  const mockSetOffRouteThreshold = vi.fn();
  const mockSetStoppedThreshold = vi.fn();
  const mockSetGeofenceRadius = vi.fn();
  const mockSaveContextSettings = vi.fn();
  const mockLoadContextSettings = vi.fn();
  const mockResetToDefaults = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapSettings as any).mockReturnValue({
      offRouteThreshold: 500,
      stoppedThreshold: 15,
      geofenceRadius: 300,
      setOffRouteThreshold: mockSetOffRouteThreshold,
      setStoppedThreshold: mockSetStoppedThreshold,
      setGeofenceRadius: mockSetGeofenceRadius,
      saveContextSettings: mockSaveContextSettings,
      loadContextSettings: mockLoadContextSettings,
      resetToDefaults: mockResetToDefaults,
    });

    // Mock window.confirm
    global.window.confirm = vi.fn(() => true);
  });

  it('renders correctly when shown', () => {
    const { getByText } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:test' })
    );
    expect(getByText('Ajustes de Precisão')).toBeTruthy();
    expect(getByText('driver:test')).toBeTruthy();
  });

  it('updates sliders correctly', () => {
    const { getAllByTestId } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const sliders = getAllByTestId('mock-slider');
    
    fireEvent.change(sliders[0], { target: { value: '1000' } });
    expect(mockSetOffRouteThreshold).toHaveBeenCalledWith(1000);

    fireEvent.change(sliders[1], { target: { value: '30' } });
    expect(mockSetStoppedThreshold).toHaveBeenCalledWith(30);

    fireEvent.change(sliders[2], { target: { value: '500' } });
    expect(mockSetGeofenceRadius).toHaveBeenCalledWith(500);
  });

  it('handles save action with loading state', async () => {
    mockSaveContextSettings.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
    
    const { getByText } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'delivery:123' })
    );
    
    const saveButton = getByText('Salvar no Perfil');
    fireEvent.click(saveButton);
    
    expect(getByText('Salvando...')).toBeTruthy();
    expect(saveButton.closest('button')).toBeDisabled();
    
    await waitFor(() => {
      expect(mockSaveContextSettings).toHaveBeenCalledWith('delivery:123');
      expect(toast.success).toHaveBeenCalledWith('Configurações Persistidas', expect.anything());
    });
  });

  it('handles individual reset buttons', async () => {
    const { getByTitle } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const resetOffRoute = getByTitle('Resetar Desvio');
    fireEvent.click(resetOffRoute);
    
    expect(global.window.confirm).toHaveBeenCalled();
    expect(mockSetOffRouteThreshold).toHaveBeenCalledWith(500);
    expect(toast.success).toHaveBeenCalledWith('Valor Restaurado', expect.anything());
  });

  it('handles global reset action with confirmation', async () => {
    const { getByTitle } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const resetButton = getByTitle('Resetar Tudo');
    fireEvent.click(resetButton);
    
    expect(global.window.confirm).toHaveBeenCalledWith(expect.stringContaining('Deseja resetar'));
    expect(mockResetToDefaults).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Valores Restaurados', expect.anything());
  });

  it('auto-reloads when activeContext changes', async () => {
    const { rerender } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'context-1' })
    );
    
    expect(mockLoadContextSettings).toHaveBeenCalledWith('context-1');
    
    // Switch context
    rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'context-2' }));
    
    await waitFor(() => {
      expect(mockLoadContextSettings).toHaveBeenCalledWith('context-2');
    });
  });

  it('handles rapid context switching without mixing state', async () => {
    const { rerender } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:A' })
    );
    
    expect(mockLoadContextSettings).toHaveBeenCalledWith('driver:A');
    
    // Rapidly switch
    rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'delivery:B' }));
    rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:C' }));
    
    await waitFor(() => {
      expect(mockLoadContextSettings).toHaveBeenLastCalledWith('driver:C');
    });
  });

  it('handles failure during save with consistent error message', async () => {
    mockSaveContextSettings.mockRejectedValue(new Error('Save Failed'));
    
    const { getByText } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const saveButton = getByText('Salvar no Perfil');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao Salvar', expect.objectContaining({
        description: expect.stringContaining('Falha na comunicação')
      }));
    });
  });

  it('handles load failure with fallback notice', async () => {
    mockLoadContextSettings.mockRejectedValue(new Error('Load Failed'));
    
    const { getByTitle } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'faulty:context' })
    );
    
    const reloadButton = getByTitle('Recarregar do Servidor');
    fireEvent.click(reloadButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao Carregar', expect.objectContaining({
        description: expect.stringContaining('segurança')
      }));
    });
  });
});

