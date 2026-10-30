import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AuthSessionService } from '../auth/auth-session.service';
import { MatchApiService } from '../matches/match-api.service';
import { MatchSearchPage } from './match-search.page';

describe('HU-11: inicio de búsqueda sin filtros', () => {
  let fixture: ComponentFixture<MatchSearchPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchSearchPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: AuthSessionService, useValue: { currentUser: signal(null), restore: () => of(null) } },
        { provide: MatchApiService, useValue: { list: () => of([]), join: () => of() } },
      ],
    }).compileComponents();
    TestBed.overrideComponent(MatchSearchPage, { set: { template: '' } });
    fixture = TestBed.createComponent(MatchSearchPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('carga sin filtros activos ni horarios preseleccionados', () => {
    const page = fixture.componentInstance;

    expect(page.activeFiltersCount).toBe(0);
    expect(page.selectedTimes).toEqual([]);
    expect(page.dayFilterEnabled).toBe(false);
    expect(page.selectedZones).toEqual([]);
    expect(page.selectedLevels).toEqual([]);
  });
});
