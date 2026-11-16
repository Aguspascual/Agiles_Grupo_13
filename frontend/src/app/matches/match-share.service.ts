import { Injectable } from '@angular/core';
import { MatchPreview } from '../landing/landing.data';

@Injectable({ providedIn: 'root' })
export class MatchShareService {
  matchLink(matchId: string): string {
    const url = new URL('/partidos', window.location.origin);
    url.searchParams.set('partido', matchId);
    return url.toString();
  }

  whatsappLink(match: MatchPreview): string {
    const matchUrl = this.matchLink(match.id);
    const text = `Te invito a sumarte al partido en ${match.club}, ${match.day} a las ${match.time}. Mirá los detalles y sumate: ${matchUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
}
