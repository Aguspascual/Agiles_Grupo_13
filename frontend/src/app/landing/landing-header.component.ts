import { Component, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';

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
        <a
          class="profile-link"
          routerLink="/ingresar"
          aria-label="Iniciar sesión, perfil de jugador"
          ><span class="profile-avatar">LM</span
          ><span class="profile-copy"><b>Lucas M.</b><small>Nivel 5ta</small></span></a
        >
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
  menuOpen = false;
  logoutOpen = false;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly router: Router,
  ) {}

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  requestLogout(): void {
    this.closeMenu();
    this.logoutOpen = true;
  }

  logout(): void {
    this.logoutOpen = false;
    void this.router.navigateByUrl('/ingresar');
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu();
    this.logoutOpen = false;
  }
}
