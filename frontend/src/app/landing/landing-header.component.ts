import { Component, ElementRef, HostListener, inject } from '@angular/core';
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
      <nav class="site-navigation" aria-label="Navegación principal">
        <div class="desktop-nav-links">
          <a
            class="nav-link"
            routerLink="/"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Inicio</a
          >
          <a class="nav-link" routerLink="/partidos" routerLinkActive="is-active"
            >Buscar partidos</a
          >
          <a class="nav-link" routerLink="/ingresar">Mis partidos</a>
          <a class="nav-link" routerLink="/clubes" routerLinkActive="is-active">Clubes</a>
        </div>
        <div class="nav-dropdown">
          <button
            #menuTrigger
            class="nav-menu-trigger"
            type="button"
            aria-controls="site-nav-menu"
            aria-label="Abrir menú de secciones"
            [attr.aria-expanded]="menuOpen"
            (click)="toggleMenu()"
          >
            <svg class="nav-menu-trigger__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span class="nav-menu-trigger__label">Secciones</span>
            <svg class="nav-menu-trigger__chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
          @if (menuOpen) {
            <div class="nav-menu-panel" id="site-nav-menu" aria-label="Secciones">
              <a
                routerLink="/"
                routerLinkActive="is-active"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="closeMenu()"
              >Inicio</a>
              <a routerLink="/partidos" routerLinkActive="is-active" (click)="closeMenu()"
                >Buscar partidos</a
              >
              <a routerLink="/ingresar" (click)="closeMenu()"
                >Mis partidos</a
              >
              <a routerLink="/clubes" routerLinkActive="is-active" (click)="closeMenu()"
                >Clubes</a
              >
              <a class="nav-menu-panel__create" routerLink="/partidos" (click)="closeMenu()"
                >Crear partido</a
              >
              @if (session.currentUser()) {
                <a class="nav-menu-panel__account" routerLink="/perfil" (click)="closeMenu()"
                  >Mi perfil</a
                >
                <button
                  class="nav-menu-panel__logout"
                  type="button"
                  (click)="requestLogout()"
                >
                  Cerrar sesión
                </button>
              } @else {
                <a class="nav-menu-panel__account" routerLink="/ingresar" (click)="closeMenu()"
                  >Ingresar</a
                >
                <a class="nav-menu-panel__account" routerLink="/registro" (click)="closeMenu()"
                  >Registrarse</a
                >
              }
            </div>
          }
        </div>
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
          <div class="profile-menu">
            <button
              class="profile-link"
              type="button"
              [attr.aria-expanded]="profileOpen"
              aria-haspopup="menu"
              aria-label="Abrir menú de usuario"
              (click)="toggleProfile()"
            >
              <span class="profile-avatar">{{ initials }}</span>
              <span class="profile-copy"><b>{{ user.name }}</b><small>Nivel {{ user.level }}</small></span>
              <span class="profile-chevron" aria-hidden="true">⌄</span>
            </button>
            @if (profileOpen) {
              <div class="profile-dropdown" role="menu">
                <a routerLink="/perfil" role="menuitem" (click)="profileOpen = false">Mi perfil</a>
                <button type="button" role="menuitem" (click)="requestLogout()">Cerrar sesión</button>
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
      <app-confirm-dialog
        title="¿Cerrar sesión?"
        message="Vas a salir de tu cuenta de PádelMatch."
        confirmLabel="Cerrar sesión"
        (cancel)="logoutOpen = false"
        (confirm)="logout()"
      />
    }
  `,
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {
  readonly session = inject(AuthSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  menuOpen = false;
  profileOpen = false;
  logoutOpen = false;

  get initials(): string {
    return (
      this.session
        .currentUser()
        ?.name.split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase() ?? ''
    );
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.profileOpen = false;
  }

  toggleProfile(): void {
    this.profileOpen = !this.profileOpen;
    this.menuOpen = false;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  requestLogout(): void {
    this.menuOpen = false;
    this.profileOpen = false;
    this.logoutOpen = true;
  }

  logout(): void {
    this.logoutOpen = false;
    this.session.logout();
    void this.router.navigateByUrl('/ingresar');
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!this.host.nativeElement.contains(target)) this.menuOpen = false;
    if (!target.closest?.('.profile-menu')) this.profileOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.menuOpen = false;
    this.profileOpen = false;
    this.logoutOpen = false;
  }
}
