import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonToSheet = vi.fn(() => ({}));
const mockBookNew = vi.fn(() => ({}));
const mockBookAppendSheet = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: (...args: unknown[]) => mockJsonToSheet(...(args as [])),
    book_new: (...args: unknown[]) => mockBookNew(...(args as [])),
    book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...(args as [])),
  },
  writeFile: (...args: unknown[]) => mockWriteFile(...(args as [])),
}));

import { exportToCSV, exportToJSON, exportToPDFText, exportToExcel } from '../exportUtils';

describe('exportToCSV', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:test');
    revokeObjectURL = vi.fn();
    clickSpy = vi.fn();
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);
    
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não deve fazer nada com array vazio', () => {
    exportToCSV([], 'test');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('deve gerar CSV com headers corretos', () => {
    const data = [
      { nome: 'Carlos', idade: 30, cidade: 'SP' },
      { nome: 'Maria', idade: 25, cidade: 'RJ' },
    ];
    exportToCSV(data, 'test');
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('deve escapar valores com vírgula', () => {
    const data = [{ name: 'Silva, Carlos', value: 100 }];
    exportToCSV(data, 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('deve escapar valores com aspas', () => {
    const data = [{ name: 'Carlos "O Rápido"', value: 50 }];
    exportToCSV(data, 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('deve lidar com null e undefined como string vazia', () => {
    const data = [{ a: null, b: undefined, c: 'ok' }];
    exportToCSV(data as Record<string, unknown>[], 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('deve escapar valores com quebra de linha', () => {
    const data = [{ desc: 'Linha 1\nLinha 2' }];
    exportToCSV(data, 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });
});

describe('exportToJSON', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:json');
    revokeObjectURL = vi.fn();
    clickSpy = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve exportar objeto simples', () => {
    exportToJSON({ key: 'value' }, 'test');
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('deve exportar array', () => {
    exportToJSON([1, 2, 3], 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('deve exportar dados complexos aninhados', () => {
    const complex = {
      orders: [{ id: 1, items: [{ name: 'A' }] }],
      meta: { total: 1, page: 1 },
    };
    exportToJSON(complex, 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('deve lidar com null', () => {
    exportToJSON(null, 'test');
    expect(createObjectURL).toHaveBeenCalled();
  });
});

describe('exportToPDFText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve abrir nova janela com window.open', () => {
    const mockWin = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(mockWin as unknown as Window);
    vi.useFakeTimers();

    exportToPDFText(
      { title: 'Relatório', sections: [{ title: 'Seção 1', content: 'Dados' }] },
      'relatorio'
    );

    expect(mockWin.document.write).toHaveBeenCalled();
    expect(mockWin.document.close).toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(mockWin.print).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('deve fazer fallback para download se window.open retorna null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const createObjectURL = vi.fn().mockReturnValue('blob:html');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLElement);

    exportToPDFText(
      { title: 'Test', sections: [{ title: 'S', content: 'C' }] },
      'test'
    );

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('deve incluir múltiplas seções no HTML', () => {
    const mockWin = {
      document: { write: vi.fn(), close: vi.fn() },
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(mockWin as unknown as Window);

    exportToPDFText(
      {
        title: 'Multi',
        sections: [
          { title: 'Seção A', content: 'Dados A' },
          { title: 'Seção B', content: 'Dados B' },
          { title: 'Seção C', content: 'Dados C' },
        ],
      },
      'multi'
    );

    const htmlWritten = mockWin.document.write.mock.calls[0][0] as string;
    expect(htmlWritten).toContain('Seção A');
    expect(htmlWritten).toContain('Seção B');
    expect(htmlWritten).toContain('Seção C');
    expect(htmlWritten).toContain('Multi');

    vi.restoreAllMocks();
  });
});
