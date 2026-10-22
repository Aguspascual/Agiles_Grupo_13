import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DemoRole, ManagerOption } from './complex.model';

@Component({
  selector: 'app-complex-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './complex-admin-sidebar.component.html',
  styleUrl: './complex-admin-sidebar.component.scss',
})
export class ComplexAdminSidebarComponent {
  @Input() complexId = 'complex-gonnet';
  @Input() showRoleSimulation = false;
  @Input() role: DemoRole = 'admin';
  @Input() managers: ManagerOption[] = [];
  @Input() managerId = '';
  @Output() roleChange = new EventEmitter<DemoRole>();
  @Output() managerChange = new EventEmitter<string>();
}
