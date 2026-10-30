import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmDialogComponent } from '../complexes/confirm-dialog.component';
import { AuthSessionService } from '../auth/auth-session.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchNotice } from '../matches/match-api.model';

@Component({
  selector: 'app-landing-header',
  imports: [DatePipe, RouterLink, RouterLinkActive, ConfirmDialogComponent],
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
          <a class="nav-link" routerLink="/mis-reservas" routerLinkActive="is-active">Mis reservas</a>
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
              <a routerLink="/mis-reservas" routerLinkActive="is-active" (click)="closeMenu()"
                >Mis reservas</a
              >
              <a routerLink="/clubes" routerLinkActive="is-active" (click)="closeMenu()"
                >Clubes</a
              >
              <a class="nav-menu-panel__create" routerLink="/partidos" [queryParams]="{ crear: 1 }" (click)="closeMenu()"
                >Crear partido</a
              >
              @if (session.currentUser()) {
                <button class="nav-menu-panel__account" type="button" (click)="toggleNotices(); closeMenu()">
                  Notificaciones
                  @if (notices.length) {
                    · {{ notices.length }}
                  }
                </button>
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
        <a class="create-match-link" routerLink="/partidos" [queryParams]="{ crear: 1 }"
          ><span aria-hidden="true">+</span> Crear partido</a
        >
        @if (session.currentUser()) {
          <div class="notification-menu">
            <button class="notification-link" type="button" aria-label="Notificaciones"
              [attr.aria-expanded]="noticesOpen" (click)="toggleNotices()">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              @if (notices.length) { <i>{{ notices.length }}</i> }
            </button>
            @if (noticesOpen) {
              <section class="notification-panel" aria-label="Notificaciones recientes">
                <b>Notificaciones</b>
                @if (loadingNotices) { <p>Cargando…</p> }
                @for (notice of notices; track notice.id) {
                  <button type="button" class="notification-item" (click)="dismissNotice(notice)">
                    <strong>Partido completo</strong>
                    <span>{{ notice.complex }} · {{ notice.startsAt | date:'EEE d MMM, HH:mm' }}</span>
                    <small>El grupo ya tiene cuatro jugadores. Tocá para marcar como leído.</small>
                  </button>
                } @empty {
                  @if (!loadingNotices) { <p>No tenés notificaciones nuevas.</p> }
                }
              </section>
            }
          </div>
        } @else {
          <a class="notification-link" routerLink="/ingresar" aria-label="Ingresar para ver notificaciones">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />
            </svg>
          </a>
        }
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
    @if (noticeBanner; as message) {
      <div class="notification-banner" role="status">
        <span>{{ message }}</span>
        <button type="button" aria-label="Marcar aviso como leído" (click)="dismissNotice(notices[0])">×</button>
      </div>
    }
  `,
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {
  readonly session = inject(AuthSessionService);
  private readonly matchApi = inject(MatchApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  menuOpen = false;
  profileOpen = false;
  logoutOpen = false;
  noticesOpen = false;
  notices: MatchNotice[] = [];
  noticeBanner = '';
  loadingNotices = false;

  toggleNotices(): void {
    this.noticesOpen = !this.noticesOpen;
    if (this.noticesOpen) this.loadNotices();
  }

  dismissNotice(notice?: MatchNotice): void {
    if (!notice) return;
    this.matchApi.markNoticeRead(notice.id).subscribe({
      next: () => {
        this.notices = this.notices.filter((item) => item.id !== notice.id);
        this.noticeBanner = this.notices.length ? this.noticeText(this.notices[0]) : '';
      },
    });
  }

  private loadNotices(): void {
    this.loadingNotices = true;
    this.matchApi.unreadNotices().subscribe({
      next: (items) => {
        this.notices = items;
        this.noticeBanner = items.length ? this.noticeText(items[0]) : '';
        this.loadingNotices = false;
      },
      error: () => { this.loadingNotices = false; },
    });
  }

  private noticeText(notice: MatchNotice): string {
    return `Tu partido en ${notice.complex} ya tiene cuatro jugadores.`;
  }

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
    if (this.menuOpen && this.session.currentUser()) this.loadNotices();
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
    if (!target.closest?.('.notification-menu')) this.noticesOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.menuOpen = false;
    this.profileOpen = false;
    this.noticesOpen = false;
    this.logoutOpen = false;
  }
}
