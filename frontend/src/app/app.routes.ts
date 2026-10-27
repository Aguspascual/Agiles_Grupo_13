import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegisterPage } from './auth/register.page';
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
    path: 'partidos/crear',
    loadComponent: () => import('./create-match/create-match-route.component').then((page) => page.CreateMatchRouteComponent),
    title: 'Crear partido | PádelMatch',
  },
  {
    path: 'clubes',
    loadComponent: () =>
      import('./landing/club-directory.page').then((page) => page.ClubDirectoryPage),
    title: 'Clubes de pádel en La Plata | PádelMatch',
  },
  {
    // HU-05: grilla pública de turnos. El título lo define la página con el nombre del club.
    path: 'clubes/:complexId/turnos',
    loadComponent: () =>
      import('./slot-grid/complex-slots.page').then((page) => page.ComplexSlotsPage),
  },
  { path: 'ingresar', component: LoginPage, title: 'Iniciar sesión | PádelMatch LP' },
  { path: 'registro', component: RegisterPage, title: 'Registro | PádelMatch LP' },
  // Las pantallas de administración se cargan bajo demanda para aliviar la carga inicial del jugador.
  {
    path: 'admin/complejos',
    loadComponent: () =>
      import('./complexes/complex-admin.page').then((page) => page.ComplexAdminPage),
    title: 'Administrar complejos | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas/:courtId/horarios',
    loadComponent: () =>
      import('./availability/court-availability.page').then((page) => page.CourtAvailabilityPage),
    title: 'Horarios disponibles | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas',
    loadComponent: () => import('./courts/court-admin.page').then((page) => page.CourtAdminPage),
    title: 'Administrar canchas | PádelMatch LP',
  },
  { path: '**', redirectTo: 'ingresar' },
];
