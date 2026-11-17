import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GoogleCalendarNavigationService } from './google-calendar-navigation.service';

describe('GoogleCalendarNavigationService', () => {
  it('navigates in the current tab without opening a popup', () => {
    const assign = vi.fn();
    const open = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: DOCUMENT, useValue: { defaultView: { location: { assign }, open } } },
    ] });
    const url = 'https://calendar.google.com/calendar/r/eventedit?action=TEMPLATE';
    TestBed.inject(GoogleCalendarNavigationService).open(url);
    expect(assign).toHaveBeenCalledExactlyOnceWith(url);
    expect(open).not.toHaveBeenCalled();
  });

  it('reports an unavailable browser instead of silently succeeding', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: null } }] });
    expect(() => TestBed.inject(GoogleCalendarNavigationService).open('https://calendar.google.com'))
      .toThrow('Browser navigation is unavailable');
  });
});
