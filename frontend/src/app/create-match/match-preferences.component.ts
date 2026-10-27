import { Component, output, signal } from '@angular/core';

export interface MatchPreferences {
  category: string;
  gender: 'Masculino' | 'Femenino' | 'Mixto';
}

@Component({
  selector: 'app-match-preferences',
  templateUrl: './match-preferences.component.html',
  styleUrl: './match-preferences.component.scss',
})
export class MatchPreferencesComponent {
  readonly preferencesChange = output<MatchPreferences>();
  readonly category = signal('5ta');
  readonly gender = signal<MatchPreferences['gender']>('Masculino');
  readonly categories = ['6ta', '5ta', '4ta', 'Nivel flexible (5ta a 6ta)'];

  updateCategory(value: string): void {
    this.category.set(value);
    this.emit();
  }

  updateGender(value: MatchPreferences['gender']): void {
    this.gender.set(value);
    this.emit();
  }

  private emit(): void {
    this.preferencesChange.emit({
      category: this.category(),
      gender: this.gender(),
    });
  }
}
