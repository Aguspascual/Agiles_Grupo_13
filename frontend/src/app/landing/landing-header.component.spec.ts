import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CreateMatchModalStore } from '../create-match/create-match-modal.store';
import { LandingHeaderComponent } from './landing-header.component';

describe('HU-06: acceso a crear partido', () => {
  it('abre el modal de reserva desde el CTA del header', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture: ComponentFixture<LandingHeaderComponent> = TestBed.createComponent(LandingHeaderComponent);
    fixture.detectChanges();
    const store = TestBed.inject(CreateMatchModalStore);

    expect(store.isOpen()).toBe(false);
    (fixture.nativeElement.querySelector('.create-match-link') as HTMLButtonElement).click();
    expect(store.isOpen()).toBe(true);
    fixture.destroy();
  });
});
