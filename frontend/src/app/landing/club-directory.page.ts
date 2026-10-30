import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ComplexApiService } from '../complexes/complex-api.service';
import { PublicComplex } from '../complexes/complex.model';
import { LandingFooterComponent } from './landing-footer.component';
import { LandingHeaderComponent } from './landing-header.component';

const ALL_ZONES = 'Todas las zonas';

/** HU-05: directorio público de clubes adheridos. */
@Component({
  selector: 'app-club-directory-page',
  imports: [FormsModule, RouterLink, LandingHeaderComponent, LandingFooterComponent],
  templateUrl: './club-directory.page.html',
  styleUrl: './club-directory.page.scss',
})
export class ClubDirectoryPage implements OnInit {
  private readonly api = inject(ComplexApiService);

  readonly clubs = signal<PublicComplex[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly searchTerm = signal('');
  readonly selectedZone = signal(ALL_ZONES);
  readonly allZones = ALL_ZONES;

  readonly zones = computed(() => [
    ALL_ZONES,
    ...[...new Set(this.clubs().map((club) => club.zone))].sort((a, b) => a.localeCompare(b, 'es')),
  ]);

  readonly filteredClubs = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    const zone = this.selectedZone();
    return this.clubs().filter((club) => {
      const matchesTerm = !term || `${club.name} ${club.zone}`.toLocaleLowerCase('es').includes(term);
      return matchesTerm && (zone === ALL_ZONES || club.zone === zone);
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set('loading');
    this.api.listPublic().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedZone.set(ALL_ZONES);
  }
}
