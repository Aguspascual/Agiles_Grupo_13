import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FullMatchApiService } from './full-match-api.service';
import { InviteeAutocompleteComponent } from './invitee-autocomplete.component';

describe('autocompletado de invitados', () => {
  const players = [
    { id: 'me', name: 'Ana Pérez', emailHint: 'a***@example.com' },
    { id: 'beto', name: 'Beto Díaz', emailHint: 'b***@example.com' },
    { id: 'carla', name: 'Carla Gómez', emailHint: 'c***@example.com' },
  ];

  async function render(excludedIds: string[]) {
    TestBed.configureTestingModule({
      imports: [InviteeAutocompleteComponent],
      providers: [{ provide: FullMatchApiService, useValue: { searchPlayers: vi.fn(() => of(players)) } }],
    });
    const fixture = TestBed.createComponent(InviteeAutocompleteComponent);
    fixture.componentRef.setInput('excludedIds', excludedIds);
    fixture.detectChanges();
    vi.useFakeTimers();
    fixture.componentInstance.updateQuery('persona');
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
    return fixture;
  }

  it('no ofrece a los jugadores excluidos (organizador o ya elegidos)', async () => {
    const fixture = await render(['me', 'beto']);
    const names = [...fixture.nativeElement.querySelectorAll('.invitee-suggestions b')].map((item) => item.textContent);

    expect(names).toEqual(['Carla Gómez']);
  });

  it('ofrece a todos cuando no hay exclusiones', async () => {
    const fixture = await render([]);

    expect(fixture.nativeElement.querySelectorAll('.invitee-suggestions li')).toHaveLength(3);
  });
});