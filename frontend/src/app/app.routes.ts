import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegisterPage } from './auth/register.page';
import { LandingPage } from './landing/landing.page';
import { MatchSearchPage } from './landing/match-search.page';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LandingPage,
    title: 'PádelMatch | Encontrá tu próximo partido',
  },
  { path: 'partidos', component: MatchSearchPage, title: 'Buscar partidos | PádelMatch' },
  {
    path: 'partidos/invitacion/:token',
    loadComponent: () => import('./matches/full-match-invitation.page').then((page) => page.FullMatchInvitationPage),
    title: 'Invitación a partido | PádelMatch',
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
  {
    path: 'perfil',
    loadComponent: () => import('./profile/player-profile.page').then((page) => page.PlayerProfilePage),
    canActivate: [authGuard],
    title: 'Editar perfil | PádelMatch',
  },
  {
    path: 'mis-reservas',
    loadComponent: () =>
      import('./reservations/my-reservations.page').then((page) => page.MyReservationsPage),
    canActivate: [authGuard],
    title: 'Mis partidos | PádelMatch',
  },
  // Las pantallas de administración se cargan bajo demanda para aliviar la carga inicial del jugador.
  {
    path: 'admin/complejos',
    loadComponent: () =>
      import('./complexes/complex-admin.page').then((page) => page.ComplexAdminPage),
    canActivate: [authGuard],
    title: 'Administrar complejos | PádelMatch LP',
  },
  {
    // Vista completa de un complejo: datos, agenda del día y gestión de canchas.
    path: 'admin/complejos/:complexId',
    loadComponent: () => import('./agenda/agenda.page').then((page) => page.AgendaPage),
    canActivate: [authGuard],
    data: { overview: true },
    title: 'Complejo | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas/:courtId/horarios',
    loadComponent: () =>
      import('./availability/court-availability.page').then((page) => page.CourtAvailabilityPage),
    canActivate: [authGuard],
    title: 'Horarios disponibles | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/canchas',
    loadComponent: () => import('./courts/court-admin.page').then((page) => page.CourtAdminPage),
    canActivate: [authGuard],
    title: 'Administrar canchas | PádelMatch LP',
  },
  {
    path: 'admin/complejos/:complexId/agenda',
    loadComponent: () => import('./agenda/agenda.page').then((page) => page.AgendaPage),
    canActivate: [authGuard],
    title: 'Agenda del complejo | PádelMatch LP',
  },
  { path: '**', redirectTo: 'ingresar' },
];
