import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthTokenStore } from '../auth/auth-token.store';
import { authInterceptor } from '../auth/auth.interceptor';
import { LandingHeaderComponent } from './landing-header.component';

describe('LandingHeaderComponent con sesión HU-01', () => {
  let fixture: ComponentFixture<LandingHeaderComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  function createHeader(): void {
    fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.detectChanges();
  }

  it('ofrece ingresar y registrarse sin mostrar identidad ficticia si no hay sesión', () => {
    createHeader();

    expect(fixture.nativeElement.textContent).toContain('Ingresar');
    expect(fixture.nativeElement.textContent).toContain('Registrarse');
    expect(fixture.nativeElement.textContent).not.toContain('Lucas M.');
    expect(fixture.nativeElement.querySelector('.profile-menu')).toBeNull();
  });

  it('muestra nombre, nivel e iniciales de la sesión autenticada', () => {
    TestBed.inject(AuthSessionService).accept(
      {
        user: {
          id: 'user-1',
          name: 'Ana Pérez',
          email: 'ana@example.com',
          zone: 'Gonnet',
          level: '7ma',
        },
        token: 'jwt-user',
      },
      false,
    );
    createHeader();

    expect(fixture.nativeElement.textContent).toContain('Ana Pérez');
    expect(fixture.nativeElement.textContent).toContain('Nivel 7ma');
    expect(fixture.nativeElement.querySelector('.profile-avatar')?.textContent).toContain('AP');
    expect(fixture.nativeElement.textContent).not.toContain('Lucas M.');
  });

  it('cierra la sesión local, limpia ambos almacenamientos y navega a ingresar', () => {
    const session = TestBed.inject(AuthSessionService);
    session.accept(
      {
        user: {
          id: 'user-1',
          name: 'Ana Pérez',
          email: 'ana@example.com',
          zone: 'Gonnet',
          level: '7ma',
        },
        token: 'jwt-user',
      },
      true,
    );
    sessionStorage.setItem(AuthTokenStore.storageKey, 'stale-session-token');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    createHeader();

    (fixture.nativeElement.querySelector('.profile-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    const logoutButton = fixture.nativeElement.querySelector(
      '.profile-dropdown button[role="menuitem"]',
    ) as HTMLButtonElement;
    logoutButton.click();
    fixture.detectChanges();
    const confirmButton = fixture.nativeElement.querySelector(
      'app-confirm-dialog .danger-button',
    ) as HTMLButtonElement;
    expect(confirmButton).not.toBeNull();
    confirmButton.click();
    fixture.detectChanges();

    expect(localStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(sessionStorage.getItem(AuthTokenStore.storageKey)).toBeNull();
    expect(session.currentUser()).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/ingresar');
    expect(fixture.nativeElement.textContent).toContain('Ingresar');
    expect(fixture.nativeElement.textContent).toContain('Registrarse');
  });
});
