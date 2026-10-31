import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ComplexAdminSidebarComponent } from '../complexes/complex-admin-sidebar.component';
import { ComplexApiService } from '../complexes/complex-api.service';
import { ComplexRecord } from '../complexes/complex.model';
import { CourtApiService } from './court-api.service';
import { CourtCardComponent } from './court-card.component';
import { CourtRecord } from './court.model';

interface ComplexCourts {
  complex: ComplexRecord;
  courts: CourtRecord[];
  failed: boolean;
}

/** Todas las canchas registradas, agrupadas por complejo. */
@Component({
  selector: 'app-all-courts-page',
  standalone: true,
  imports: [RouterLink, ComplexAdminSidebarComponent, CourtCardComponent],
  templateUrl: './all-courts.page.html',
  styleUrl: './all-courts.page.scss',
})
export class AllCourtsPage implements OnInit {
  private readonly complexApi = inject(ComplexApiService);
  private readonly courtApi = inject(CourtApiService);

  readonly groups = signal<ComplexCourts[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly totalCourts = computed(() => this.groups().reduce((sum, group) => sum + group.courts.length, 0));
  readonly summary = computed(() => {
    const courts = this.totalCourts();
    const complexes = this.groups().length;
    return `${courts} ${courts === 1 ? 'cancha' : 'canchas'} en ${complexes} ${complexes === 1 ? 'complejo' : 'complejos'}`;
  });

  constructor() {
    inject(Title).setTitle('Canchas | PádelMatch LP');
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.complexApi
      .list()
      .pipe(
        switchMap((complexes) =>
          complexes.length
            ? forkJoin(
                complexes.map((complex) =>
                  this.courtApi.list(complex.id).pipe(
                    catchError(() => of(null)),
                  ),
                ),
              ).pipe(
                map((lists) => complexes.map((complex, index): ComplexCourts => ({ complex, courts: lists[index] ?? [], failed: lists[index] === null }))),
              )
            : of([] as ComplexCourts[]),
        ),
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 0
              ? 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.'
              : 'No pudimos cargar las canchas. Intentá nuevamente.',
          );
        },
      });
  }
}