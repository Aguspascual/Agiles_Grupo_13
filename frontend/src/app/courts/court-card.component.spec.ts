import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CourtCardComponent } from './court-card.component';

describe('HU-04: acceso a horarios desde la tarjeta de cancha', () => {
  async function renderCard() {
    await TestBed.configureTestingModule({
      imports: [CourtCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(CourtCardComponent);
    fixture.componentRef.setInput('court', {
      id: 'court-gonnet-1', complexId: 'complex-gonnet', name: 'Cancha 1', covered: true,
      imageDataUrl: null, features: [],
    });
    fixture.detectChanges();
    return fixture;
  }

  it('links to the selected court schedule', async () => {
    const fixture = await renderCard();
    (fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[aria-label="Administrar horarios de Cancha 1"]');
    expect(link?.getAttribute('href')).toBe(
      '/admin/complejos/complex-gonnet/canchas/court-gonnet-1/horarios',
    );
    fixture.destroy();
  });

  it('keeps the card actions inside one accessible dropdown', async () => {
    const fixture = await renderCard();
    const trigger = fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement;

    expect(trigger.getAttribute('aria-label')).toBe('Acciones de Cancha 1');
    expect(trigger.querySelectorAll('svg circle')).toHaveLength(3);
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(fixture.nativeElement.querySelectorAll('.card-actions a, .card-actions button')).toHaveLength(1);
    trigger.click();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Dar de baja');
    fixture.destroy();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const fixture = await renderCard();
    const trigger = fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
  });

  it('emits the selected court for edit and deactivation actions', async () => {
    const fixture = await renderCard();
    const edit = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.remove.subscribe(remove);
    const trigger = fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-action="edit"]') as HTMLButtonElement).click();
    trigger.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-action="remove"]') as HTMLButtonElement).click();

    expect(edit).toHaveBeenCalledWith(fixture.componentInstance.court);
    expect(remove).toHaveBeenCalledWith(fixture.componentInstance.court);
    fixture.destroy();
  });
});
