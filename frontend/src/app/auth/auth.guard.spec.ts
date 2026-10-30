import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  it('redirige a ingreso si /me no recupera un usuario', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { restore: () => of(null) } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin/complejos' } as never),
    );
    const guardResult = await firstValueFrom(isObservable(result) ? result : of(result));
    expect(guardResult).toBeInstanceOf(UrlTree);
    const tree = guardResult as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/ingresar?returnUrl=%2Fadmin%2Fcomplejos');
  });

  it('permite una ruta protegida si la sesión está validada', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: { restore: () => of({ id: 'u1', name: 'Ana' }) },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin/complejos' } as never),
    );
    expect(await firstValueFrom(isObservable(result) ? result : of(result))).toBe(true);
  });
});
