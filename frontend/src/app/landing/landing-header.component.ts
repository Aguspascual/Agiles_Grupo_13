import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { AuthSessionService } from '../auth/auth-session.service';

@Component({
  selector: 'app-landing-header',
  imports: [RouterLink, RouterLinkActive, ConfirmDialogComponent],
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="PádelMatch, inicio">
        <img src="/images/padelmatch-logo.jpg" alt="" width="29" height="29" />
        <span>Pádel<span class="brand-accent">Match</span><small>LA PLATA</small></span>
      </a>
      <nav aria-label="Navegación principal">
        <a
          class="nav-link"
          routerLink="/"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Inicio</a
        >
        <a class="nav-link" routerLink="/partidos" routerLinkActive="is-active">Buscar partidos</a>
        <a class="nav-link nav-secondary" routerLink="/ingresar">Mis partidos</a>
        <a class="nav-link nav-secondary" routerLink="/clubes" routerLinkActive="is-active"
          >Clubes</a
        >
      </nav>
      <div class="header-actions">
        <a class="create-match-link" routerLink="/partidos"
          ><span aria-hidden="true">+</span> Crear partido</a
        >
        <a class="notification-link" routerLink="/ingresar" aria-label="Notificaciones"
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" /></svg
        ></a>
        @if (session.currentUser(); as user) {
          <div class="profile-menu" (click)="$event.stopPropagation()">
            <button class="profile-link" type="button" [attr.aria-expanded]="menuOpen" aria-haspopup="menu" aria-label="Abrir menú de usuario" (click)="menuOpen = !menuOpen">
              <span class="profile-avatar">{{ initials }}</span>
              <span class="profile-copy"><b>{{ user.name }}</b><small>Nivel {{ user.level }}</small></span>
              <span class="profile-chevron" aria-hidden="true">⌄</span>
            </button>
            @if (menuOpen) {
              <div class="profile-dropdown" role="menu">
                <a routerLink="/perfil" role="menuitem" (click)="menuOpen = false">Mi perfil</a>
                <button type="button" role="menuitem" (click)="menuOpen = false; logoutOpen = true">Cerrar sesión</button>
              </div>
            }
          </div>
        } @else {
          <a class="profile-link" routerLink="/ingresar">Ingresar</a>
          <a class="create-match-link" routerLink="/registro">Registrarse</a>
        }
      </div>
    </header>
    @if (logoutOpen) {
      <app-confirm-dialog title="¿Cerrar sesión?" message="Vas a salir de tu cuenta de PádelMatch." confirmLabel="Cerrar sesión" (cancel)="logoutOpen = false" (confirm)="logout()" />
    }
  `,
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {
  readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  menuOpen = false;
  logoutOpen = false;

  get initials(): string {
    return this.session.currentUser()?.name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() ?? '';
  }

  @HostListener('document:click')
  closeMenu(): void { this.menuOpen = false; }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.menuOpen = false;
    this.logoutOpen = false;
  }

  logout(): void {
    this.logoutOpen = false;
    this.session.logout();
    void this.router.navigateByUrl('/ingresar');
  }
}
