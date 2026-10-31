import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthSessionService } from '../auth/auth-session.service';

@Component({
  selector: 'app-complex-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './complex-admin-sidebar.component.html',
  styleUrl: './complex-admin-sidebar.component.scss',
})
export class ComplexAdminSidebarComponent {
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);

  @Input() complexId = '';

  /** La sección Canchas incluye el listado general y la administración de las canchas de un complejo. */
  isCourtsRoute(): boolean {
    return /^\/admin\/(canchas|complejos\/[^/]+\/canchas)(\/|$)/.test(this.router.url.split('?')[0]);
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/ingresar');
  }
}
