import { TestBed } from '@angular/core/testing';
import { CourtPositionPickerComponent } from './court-position-picker.component';

describe('selector de lugar en la cancha', () => {
  function render(value: number | null) {
    TestBed.configureTestingModule({ imports: [CourtPositionPickerComponent] });
    const fixture = TestBed.createComponent(CourtPositionPickerComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('initials', 'AP');
    fixture.detectChanges();
    return fixture;
  }

  it('muestra los cuatro lugares de las dos parejas y marca el elegido con las iniciales', () => {
    const fixture = render(2);
    const spots = [...fixture.nativeElement.querySelectorAll('[role="radio"]')] as HTMLButtonElement[];

    expect(spots.map((spot) => spot.getAttribute('aria-label'))).toEqual(['Pareja A, Drive', 'Pareja A, Revés', 'Pareja B, Drive', 'Pareja B, Revés']);
    expect(spots.map((spot) => spot.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    expect(spots[1].textContent).toContain('AP');
    expect(fixture.nativeElement.querySelector('.court-picker__summary')?.textContent).toContain('Pareja A · Revés');
  });

  it('emite el lugar al presionarlo', () => {
    const fixture = render(null);
    const chosen: number[] = [];
    fixture.componentInstance.valueChange.subscribe((slot) => chosen.push(slot));

    (fixture.nativeElement.querySelectorAll('[role="radio"]')[3] as HTMLButtonElement).click();

    expect(chosen).toEqual([4]);
    expect(fixture.nativeElement.querySelector('.court-picker__summary')?.textContent).toContain('Elegí tu lugar');
  });
});