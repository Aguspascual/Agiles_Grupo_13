import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarNavigationService {
  private readonly document = inject(DOCUMENT);

  open(url: string): void {
    const browser = this.document.defaultView;
    if (!browser) throw new Error('Browser navigation is unavailable');
    // Same-tab navigation works after the address lookup without popup permissions.
    // assign preserves the reservation page in browser history for the Back action.
    browser.location.assign(url);
  }
}
