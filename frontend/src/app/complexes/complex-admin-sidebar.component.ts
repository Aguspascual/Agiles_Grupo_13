import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-complex-admin-sidebar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './complex-admin-sidebar.component.html',
  styleUrl: './complex-admin-sidebar.component.scss',
})
export class ComplexAdminSidebarComponent {}
