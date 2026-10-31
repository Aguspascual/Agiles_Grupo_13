import { TestBed } from '@angular/core/testing';
import { MultiSelectComponent } from './multi-select.component';

describe('selector de varias opciones', () => {
  const options = [
    { value: 'a', label: 'Ana Gómez', hint: 'ana@example.com' },
    { value: 'b', label: 'Beto Díaz', hint: 'beto@example.com' },
  ];

  function render(selected: string[] = [], disabled = false) {
    TestBed.configureTestingModule({ imports: [MultiSelectComponent] });
    const fixture = TestBed.createComponent(MultiSelectComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    return fixture;
  }

  const open = (fixture: ReturnType<typeof render>) => {
    (fixture.nativeElement.querySelector('.multi-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('muestra las opciones con su correo y permite marcar varias', () => {
    const fixture = render();
    const emitted: string[][] = [];
    fixture.componentInstance.selectedChange.subscribe((value) => emitted.push(value));
    open(fixture);

    const items = fixture.nativeElement.querySelectorAll('.multi-menu [role="option"]') as NodeListOf<HTMLElement>;
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('ana@example.com');
    items[0].click();
    fixture.componentRef.setInput('selected', ['a']);
    fixture.detectChanges();
    items[1].click();

    expect(emitted).toEqual([['a'], ['a', 'b']]);
    expect(fixture.nativeElement.querySelector('.multi-chip')?.textContent).toContain('Ana Gómez');
  });

  it('quita una opción desde su etiqueta', () => {
    const fixture = render(['a', 'b']);
    const emitted: string[][] = [];
    fixture.componentInstance.selectedChange.subscribe((value) => emitted.push(value));

    (fixture.nativeElement.querySelector('.multi-chip-remove') as HTMLElement).click();

    expect(emitted).toEqual([['b']]);
  });

  it('no abre el menú cuando está deshabilitado', () => {
    const fixture = render(['a'], true);
    open(fixture);

    expect(fixture.nativeElement.querySelector('.multi-menu')).toBeNull();
    expect(fixture.nativeElement.querySelector('.multi-chip-remove')).toBeNull();
  });
});