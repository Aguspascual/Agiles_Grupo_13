import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COURT_FEATURES } from '../courts/court.model';
import { PublicComplex, PublicCourt } from '../complexes/complex.model';

export interface FeaturedSlide {
  key: string;
  courtName: string;
  kind: string;
  features: string[];
  complexId: string;
  complexName: string;
  location: string;
  image: string | null;
}

const AUTOPLAY_MS = 5000;
const MAX_FEATURES = 3;

/** Carrusel de la tarjeta "Complejo registrado": pasa las canchas publicadas con su imagen e información. */
@Component({
  selector: 'app-featured-courts',
  imports: [RouterLink],
  templateUrl: './featured-courts.component.html',
  styleUrl: './featured-courts.component.scss',
})
export class FeaturedCourtsComponent implements OnInit, OnChanges, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() courts: PublicCourt[] = [];
  @Input() complexes: PublicComplex[] = [];

  slides: FeaturedSlide[] = [];
  readonly index = signal(0);
  private paused = false;
  private reducedMotion = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (!this.reducedMotion) this.timer = setInterval(() => this.tick(), AUTOPLAY_MS);
  }

  ngOnChanges(): void {
    this.slides = this.buildSlides();
    if (this.index() >= this.slides.length) this.index.set(0);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  get autoplay(): boolean {
    return !this.reducedMotion;
  }

  go(position: number): void {
    const total = this.slides.length;
    if (total) this.index.set(((position % total) + total) % total);
  }

  next(): void {
    this.go(this.index() + 1);
  }

  previous(): void {
    this.go(this.index() - 1);
  }

  pause(value: boolean): void {
    this.paused = value;
  }

  hasFocus(): boolean {
    return this.host.nativeElement.contains(document.activeElement);
  }

  private tick(): void {
    if (this.paused || this.slides.length < 2 || this.hasFocus()) return;
    this.next();
  }

  private buildSlides(): FeaturedSlide[] {
    const images = new Map(this.complexes.map((complex) => [complex.id, complex.imageUrl ?? null]));
    if (this.courts.length) {
      return this.courts.map((court) => ({
        key: court.id,
        courtName: court.name,
        kind: court.covered ? 'Techada' : 'Descubierta',
        features: COURT_FEATURES.filter((feature) => court.features.includes(feature.id)).map((feature) => feature.label).slice(0, MAX_FEATURES),
        complexId: court.complexId,
        complexName: court.complexName,
        location: `${court.complexAddress} · ${court.complexZone}`,
        image: court.imageUrl ?? images.get(court.complexId) ?? null,
      }));
    }
    return this.complexes.slice(0, 1).map((complex) => ({
      key: complex.id,
      courtName: complex.name,
      kind: '',
      features: [],
      complexId: complex.id,
      complexName: complex.name,
      location: `${complex.address} · ${complex.zone}`,
      image: complex.imageUrl ?? null,
    }));
  }
}