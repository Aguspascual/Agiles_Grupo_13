import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-landing-header',
  imports: [RouterLink, RouterLinkActive],
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
        <a
          class="profile-link"
          routerLink="/ingresar"
          aria-label="Iniciar sesión, perfil de jugador"
          ><span class="profile-avatar">LM</span
          ><span class="profile-copy"><b>Lucas M.</b><small>Nivel 5ta</small></span></a
        >
      </div>
    </header>
  `,
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {}
