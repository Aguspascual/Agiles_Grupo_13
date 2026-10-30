import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { inject } from '@angular/core';
import { AuthSessionService } from './auth-session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  return session.restore().pipe(
    map((user) => (user ? true : router.createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } }))),
    catchError(() => of(router.createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } }))),
  );
};
