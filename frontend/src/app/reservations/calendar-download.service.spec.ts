import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarDownloadService } from './calendar-download.service';

describe('CalendarDownloadService', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('downloads a UTF-8 calendar Blob and releases the temporary link and URL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:calendar-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      link = this;
      expect(this.isConnected).toBe(true);
    });
    TestBed.inject(CalendarDownloadService).save('SUMMARY:Árbol 🎾\r\n', 'reserva-r1.ics');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/calendar;charset=utf-8');
    const content = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob, 'UTF-8');
    });
    expect(content).toBe('SUMMARY:Árbol 🎾\r\n');
    expect(link?.download).toBe('reserva-r1.ics');
    expect(link?.isConnected).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:calendar-test');
  });
});
