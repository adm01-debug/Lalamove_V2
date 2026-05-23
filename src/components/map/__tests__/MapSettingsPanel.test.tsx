import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MapSettingsPanel } from '../MapSettingsPanel';
import { useMapSettings } from '@/hooks/useMapSettings';
import { toast } from 'sonner';
import { createElement } from 'react';

// Mock ResizeObserver for Radix components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
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
    const { getAllByRole } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    // Sliders in Radix are div role="slider"
    const sliders = getAllByRole('slider');
    
    // Test Off Route Threshold slider
    fireEvent.keyDown(sliders[0], { key: 'ArrowRight' });
    expect(mockSetOffRouteThreshold).toHaveBeenCalled();

    // Test Stopped Threshold slider
    fireEvent.keyDown(sliders[1], { key: 'ArrowRight' });
    expect(mockSetStoppedThreshold).toHaveBeenCalled();

    // Test Geofence Radius slider
    fireEvent.keyDown(sliders[2], { key: 'ArrowRight' });
    expect(mockSetGeofenceRadius).toHaveBeenCalled();
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

  it('handles reset action with confirmation', async () => {
    const { getByTitle } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const resetButton = getByTitle('Resetar para Padrão');
    fireEvent.click(resetButton);
    
    expect(global.window.confirm).toHaveBeenCalledWith(expect.stringContaining('Deseja resetar'));
    expect(mockResetToDefaults).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Valores Restaurados', expect.anything());
  });

  it('handles reset cancellation', async () => {
    (global.window.confirm as any).mockReturnValue(false);
    
    const { getByTitle } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn() })
    );
    
    const resetButton = getByTitle('Resetar para Padrão');
    fireEvent.click(resetButton);
    
    expect(mockResetToDefaults).not.toHaveBeenCalled();
  });

  it('handles context reload', async () => {
    const { getByRole } = render(
      createElement(MapSettingsPanel, { show: true, onClose: vi.fn(), activeContext: 'context:custom' })
    );
    
    // The reload button has RefreshCw icon
    const buttons = document.querySelectorAll('button');
    const reloadButton = Array.from(buttons).find(b => b.querySelector('svg.lucide-refresh-cw'));
    
    if (reloadButton) {
      fireEvent.click(reloadButton);
      expect(mockLoadContextSettings).toHaveBeenCalledWith('context:custom');
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Configurações Carregadas', expect.anything());
      });
    }
  });
});
