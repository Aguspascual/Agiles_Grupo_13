import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegisterPage } from './auth/register.page';
import { ComplexAdminPage } from './complexes/complex-admin.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
  { path: 'ingresar', component: LoginPage, title: 'Iniciar sesión | PádelMatch LP' },
  { path: 'registro', component: RegisterPage, title: 'Registro | PádelMatch LP' },
  { path: 'admin/complejos', component: ComplexAdminPage, title: 'Administrar complejos | PádelMatch LP' },
  { path: '**', redirectTo: 'ingresar' },
];
