import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, catchError, distinctUntilChanged, of, switchMap, timer } from 'rxjs';
import { FullMatchApiService, FullMatchInviteeSuggestion } from './full-match-api.service';

export interface InviteeDraft {
  query: string;
  selected: FullMatchInviteeSuggestion | null;
}

@Component({
  selector: 'app-invitee-autocomplete',
  imports: [FormsModule],
  templateUrl: './invitee-autocomplete.component.html',
  styleUrl: './invitee-autocomplete.component.scss',
})
export class InviteeAutocompleteComponent implements OnInit, OnDestroy {
  @Input() label = 'Jugador invitado';
  @Input() inputId = 'invitee-search';
  /** Jugadores que no deben ofrecerse (el organizador y los ya elegidos en otros lugares). */
  @Input() excludedIds: string[] = [];
  @Output() selectionChange = new EventEmitter<InviteeDraft>();

  private readonly api = inject(FullMatchApiService);
  private readonly queryChanges = new Subject<string>();
  private searchRequest?: Subscription;

  query = '';
  selected: FullMatchInviteeSuggestion | null = null;
  suggestions: FullMatchInviteeSuggestion[] = [];
  searching = false;
  searched = false;
  searchFailed = false;

  ngOnInit(): void {
    this.searchRequest = this.queryChanges.pipe(
      distinctUntilChanged(),
      switchMap((value) => {
        const query = value.trim();
        if (characterCount(query) < 6) return of([] as FullMatchInviteeSuggestion[]);
        this.searching = true;
        this.searched = true;
        return timer(250).pipe(
          switchMap(() => this.api.searchPlayers(query).pipe(catchError(() => {
            this.searchFailed = true;
            return of([] as FullMatchInviteeSuggestion[]);
          }))),
        );
      }),
    ).subscribe((players) => {
      this.suggestions = players;
      this.searching = false;
    });
  }

  get visibleSuggestions(): FullMatchInviteeSuggestion[] {
    return this.suggestions.filter((player) => !this.excludedIds.includes(player.id));
  }

  updateQuery(query: string): void {
    this.query = query;
    this.selected = null;
    this.suggestions = [];
    this.searching = characterCount(query) >= 6;
    this.searched = false;
    this.searchFailed = false;
    this.selectionChange.emit({ query, selected: null });
    this.queryChanges.next(query);
  }

  select(player: FullMatchInviteeSuggestion): void {
    this.query = player.name;
    this.selected = player;
    this.suggestions = [];
    this.searching = false;
    this.selectionChange.emit({ query: player.name, selected: player });
    this.queryChanges.next('');
  }

  clear(): void {
    this.updateQuery('');
  }

  queryLength(value: string): number {
    return characterCount(value);
  }

  ngOnDestroy(): void {
    this.searchRequest?.unsubscribe();
  }
}

function characterCount(value: string): number {
  return Array.from(value.trim()).length;
}
