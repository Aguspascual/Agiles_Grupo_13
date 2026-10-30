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

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/ingresar');
  }
}
