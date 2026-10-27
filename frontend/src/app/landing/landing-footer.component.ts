import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer',
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div class="footer-about">
        <a class="footer-brand" routerLink="/">PádelMatch <span>LP</span></a>
        <p>
          La plataforma líder de matchmaking, reservas y torneos de pádel amateur en La Plata y
          alrededores.
        </p>
      </div>
      <nav aria-label="Clubes de La Plata">
        <strong>Clubes La Plata</strong><a routerLink="/clubes">Club Estudiantes Pádel</a
        ><a routerLink="/clubes">Gimnasia Pádel Hub</a><a routerLink="/clubes">La Cumbre Pádel</a
        ><a routerLink="/clubes">City Bell Padel Club</a>
      </nav>
      <nav aria-label="Comunidad de La Plata">
        <strong>Comunidad LP</strong><a routerLink="/partidos">Ranking categorías</a
        ><a routerLink="/partidos">Circuito Platense</a
        ><a routerLink="/partidos">Grupos WhatsApp de turnos</a
        ><a routerLink="/partidos">Reglamento APA</a>
      </nav>
      <nav aria-label="Soporte">
        <strong>Soporte</strong><a routerLink="/registro">Registrar mi club</a
        ><a routerLink="/ingresar">Preguntas frecuentes</a
        ><a routerLink="/ingresar">Términos y condiciones</a>
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
