import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LandingFooterComponent } from './landing-footer.component';
import { LandingHeaderComponent } from './landing-header.component';
import { ClubPreview, FEATURED_CLUBS, ZONES } from './landing.data';

@Component({
  selector: 'app-club-directory-page',
  imports: [FormsModule, RouterLink, LandingHeaderComponent, LandingFooterComponent],
  templateUrl: './club-directory.page.html',
  styleUrl: './club-directory.page.scss',
})
export class ClubDirectoryPage {
  readonly clubs = FEATURED_CLUBS;
  readonly zones = ['Todas las zonas', ...ZONES];
  searchTerm = '';
  selectedZone = 'Todas las zonas';

  get filteredClubs(): ClubPreview[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('es');
    return this.clubs.filter((club) => {
      const matchesTerm =
        !term || `${club.name} ${club.zone}`.toLocaleLowerCase('es').includes(term);
      const matchesZone =
        this.selectedZone === 'Todas las zonas' || club.zone.includes(this.selectedZone);
      return matchesTerm && matchesZone;
    });
  }
}
