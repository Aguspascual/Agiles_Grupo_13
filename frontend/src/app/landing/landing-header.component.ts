import { Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CreateMatchModalStore } from '../create-match/create-match-modal.store';

@Component({
  selector: 'app-landing-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="PádelMatch, inicio">
        <img src="/images/padelmatch-logo.jpg" alt="" width="29" height="29" />
        <span>Pádel<span class="brand-accent">Match</span><small>LA PLATA</small></span>
      </a>
      <nav class="desktop-nav" aria-label="Navegación principal">
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
        <button class="create-match-link" type="button" (click)="openCreateMatch()">
          <span aria-hidden="true">+</span> Crear partido
        </button>
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
      <button class="mobile-menu-trigger" type="button" aria-label="Abrir menú" [attr.aria-expanded]="menuOpen" aria-controls="mobile-navigation" (click)="toggleMenu()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
      </button>
      @if (menuOpen) {
        <nav id="mobile-navigation" class="mobile-nav" aria-label="Navegación móvil">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">Inicio</a>
          <a routerLink="/partidos" routerLinkActive="is-active" (click)="closeMenu()">Buscar partidos</a>
          <a routerLink="/ingresar" (click)="closeMenu()">Mis partidos</a>
          <a routerLink="/clubes" routerLinkActive="is-active" (click)="closeMenu()">Clubes</a>
          <button class="mobile-nav__create" type="button" (click)="openCreateMatch()">Crear partido <span aria-hidden="true">+</span></button>
        </nav>
      }
    </header>
  `,
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {
  private readonly createMatchModal = inject(CreateMatchModalStore);
  menuOpen = false;

  openCreateMatch(): void {
    this.closeMenu();
    this.createMatchModal.open();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closeMenu();
  }
}
