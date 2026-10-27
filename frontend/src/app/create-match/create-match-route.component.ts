import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CreateMatchModalStore } from './create-match-modal.store';

/** Mantiene compatible la URL anterior y la convierte en acceso al modal compartido. */
@Component({ selector: 'app-create-match-route', template: '' })
export class CreateMatchRouteComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly modal = inject(CreateMatchModalStore);

  ngOnInit(): void {
    this.modal.open();
    void this.router.navigateByUrl('/partidos', { replaceUrl: true });
  }
}
