import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegisterPage } from './auth/register.page';
import { ComplexAdminPage } from './complexes/complex-admin.page';
import { CourtAdminPage } from './courts/court-admin.page';
import { CourtAvailabilityPage } from './availability/court-availability.page';
import { LandingPage } from './landing/landing.page';
import { MatchSearchPage } from './landing/match-search.page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LandingPage,
    title: 'PádelMatch | Encontrá tu próximo partido',
  },
  { path: 'partidos', component: MatchSearchPage, title: 'Buscar partidos | PádelMatch' },
  {
    path: 'clubes',
    loadComponent: () =>
      import('./landing/club-directory.page').then((page) => page.ClubDirectoryPage),
    title: 'Clubes de pádel en La Plata | PádelMatch',
  },
  { path: 'ingresar', component: LoginPage, title: 'Iniciar sesión | PádelMatch LP' },
  { path: 'registro', component: RegisterPage, title: 'Registro | PádelMatch LP' },
  {
    path: 'admin/complejos',
    component: ComplexAdminPage,
    title: 'Administrar complejos | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas/:courtId/horarios',
    component: CourtAvailabilityPage,
    title: 'Horarios disponibles | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas',
    component: CourtAdminPage,
    title: 'Administrar canchas | PádelMatch LP',
  },
  { path: '**', redirectTo: 'ingresar' },
];
