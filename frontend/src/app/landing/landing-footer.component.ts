import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer',
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div class="footer-about">
        <a class="footer-brand" routerLink="/">PádelMatch <span>LP</span></a>
        <p>Partidos abiertos y complejos publicados en La Plata.</p>
      </div>
      <nav aria-label="Explorar">
        <strong>Explorar</strong><a routerLink="/clubes">Complejos publicados</a
        ><a routerLink="/partidos">Partidos abiertos</a>
      </nav>
      <nav aria-label="Soporte">
        <strong>Soporte</strong><a routerLink="/registro">Registrar mi club</a
        ><a routerLink="/ingresar">Ingresar</a>
      </nav>
      <small class="footer-copyright"
        >© 2026 PádelMatch La Plata. Todos los derechos reservados.</small
      >
      <small class="footer-tagline">Impulsando el pádel amateur platense.</small>
    </footer>
  `,
  styleUrl: './landing-footer.component.scss',
})
export class LandingFooterComponent {}
