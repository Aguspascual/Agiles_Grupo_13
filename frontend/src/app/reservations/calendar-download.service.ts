import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CalendarDownloadService {
  private readonly document = inject(DOCUMENT);

  save(content: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = this.document.createElement('a');
    try {
      link.href = url;
      link.download = filename;
      this.document.body.append(link);
      link.click();
    } finally {
      link.remove();
      // Let the browser consume the download before releasing the object URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}
