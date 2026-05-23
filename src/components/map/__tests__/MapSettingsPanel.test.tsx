import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock the Slider component
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

// Mock framer-motion
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
    mockLoadContextSettings.mockResolvedValue(undefined);
    mockSaveContextSettings.mockResolvedValue(undefined);
    
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

    global.window.confirm = vi.fn(() => true);
  });

  it('renders correctly when shown', async () => {
    let result: any;
    await act(async () => {
      result = render(
        createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:test' })
      );
    });
    
    expect(result.getByText('Ajustes de Precisão')).toBeTruthy();
    expect(result.getByText('driver:test')).toBeTruthy();
  });

  it('updates sliders correctly', async () => {
    let result: any;
    await act(async () => {
      result = render(createElement(MapSettingsPanel, { show: true, onClose: vi.fn() }));
    });
    
    const sliders = result.getAllByTestId('mock-slider');
    
    await act(async () => {
      fireEvent.change(sliders[0], { target: { value: '1000' } });
    });
    expect(mockSetOffRouteThreshold).toHaveBeenCalledWith(1000);
  });

  it('handles save action with loading state', async () => {
    let resolveSave: any;
    const savePromise = new Promise(resolve => { resolveSave = resolve; });
    mockSaveContextSettings.mockReturnValue(savePromise);
    
    let result: any;
    await act(async () => {
      result = render(
        createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'delivery:123' })
      );
    });
    
    const saveButton = result.getByText('Salvar no Perfil');
    
    await act(async () => {
      fireEvent.click(saveButton);
    });
    
    expect(result.getByText('Salvando...')).toBeTruthy();
    
    await act(async () => {
      resolveSave();
    });
    
    await waitFor(() => {
      expect(mockSaveContextSettings).toHaveBeenCalledWith('delivery:123');
      expect(toast.success).toHaveBeenCalledWith('Configurações Persistidas', expect.anything());
    });
  });

  it('handles individual reset buttons', async () => {
    let result: any;
    await act(async () => {
      result = render(createElement(MapSettingsPanel, { show: true, onClose: vi.fn() }));
    });
    
    const resetOffRoute = result.getByTitle('Resetar Desvio');
    await act(async () => {
      fireEvent.click(resetOffRoute);
    });
    
    expect(global.window.confirm).toHaveBeenCalled();
    expect(mockSetOffRouteThreshold).toHaveBeenCalledWith(500);
  });

  it('auto-reloads when activeContext changes', async () => {
    let result: any;
    await act(async () => {
      result = render(
        createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'context-1' })
      );
    });
    
    expect(mockLoadContextSettings).toHaveBeenCalledWith('context-1');
    
    await act(async () => {
      result.rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'context-2' }));
    });
    
    await waitFor(() => {
      expect(mockLoadContextSettings).toHaveBeenCalledWith('context-2');
    });
  });

  it('handles rapid context switching without mixing state', async () => {
    let result: any;
    await act(async () => {
      result = render(
        createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:A' })
      );
    });
    
    expect(mockLoadContextSettings).toHaveBeenCalledWith('driver:A');
    
    await act(async () => {
      result.rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'delivery:B' }));
      result.rerender(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'driver:C' }));
    });
    
    await waitFor(() => {
      expect(mockLoadContextSettings).toHaveBeenLastCalledWith('driver:C');
    });
  });

  it('handles failure during save with consistent error message', async () => {
    mockSaveContextSettings.mockRejectedValue(new Error('Save Failed'));
    
    let result: any;
    await act(async () => {
      result = render(createElement(MapSettingsPanel, { show: true, onClose: vi.fn() }));
    });
    
    const saveButton = result.getByText('Salvar no Perfil');
    await act(async () => {
      fireEvent.click(saveButton);
    });
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao Salvar', expect.objectContaining({
        description: expect.stringContaining('Falha na comunicação')
      }));
    });
  });

  it('handles load failure with fallback notice', async () => {
    mockLoadContextSettings.mockRejectedValue(new Error('Load Failed'));
    
    let result: any;
    await act(async () => {
      result = render(createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'faulty:context' }));
    });
    
    const reloadButton = result.getByTitle('Recarregar do Servidor');
    await act(async () => {
      fireEvent.click(reloadButton);
    });
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao Carregar', expect.objectContaining({
        description: expect.stringContaining('segurança')
      }));
    });
  });
});
