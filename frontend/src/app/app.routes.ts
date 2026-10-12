import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegisterPage } from './auth/register.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
  { path: 'ingresar', component: LoginPage, title: 'Iniciar sesión | PádelMatch LP' },
  { path: 'registro', component: RegisterPage, title: 'Registro | PádelMatch LP' },
  { path: '**', redirectTo: 'ingresar' },
];
