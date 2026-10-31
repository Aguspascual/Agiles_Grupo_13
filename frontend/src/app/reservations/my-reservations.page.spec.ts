import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { MyReservationsPage } from './my-reservations.page';

const LIST_URL = '/api/v1/me/reservations';

const base = {
  status: 'reserved',
  complex: { id: 'c-1', name: 'Club Norte' },
  court: { id: 'k-1', name: 'Cancha 1' },
  startsAt: '2026-11-03T18:00:00-03:00',
  endsAt: '2026-11-03T19:30:00-03:00',
  timeZone: 'America/Argentina/Buenos_Aires',
};

const reservation = (id: string, over: Record<string, unknown> = {}) => ({
  ...base,
  kind: 'reservation',
  id,
  reservationId: id,
  role: 'organizer',
  cancellable: true,
  ...over,
});

const match = (id: string, over: Record<string, unknown> = {}, info: Record<string, unknown> = {}) => ({
  ...base,
  kind: 'match',
  id,
  reservationId: `res-${id}`,
  role: 'player',
  cancellable: false,
  match: { status: 'open', targetLevel: '5ta', missingPlayers: 2, ...info },
  ...over,
});

const page = (items: unknown[], hasMore = false, offset = 0) => ({ items, page: { limit: 20, offset, hasMore } });

describe('HU-17: Mis reservas', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<MyReservationsPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const toast = () => root().querySelector('.toast p')?.textContent ?? '';
  const cards = () => [...root().querySelectorAll<HTMLElement>('[data-reservation-card]')];
  const buttonByText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === label);

  async function settle(): Promise<void> {
    flushNextTurn();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** En "Jugados" la página consulta también los próximos turnos para la tarjeta "Próximo turno". */
  function flushNextTurn(upcoming: unknown = page([])): void {
    if (fixture.componentInstance.view() !== 'past') return;
    for (const req of http.match((request) => request.url === LIST_URL && request.params.get('view') === 'upcoming')) req.flush(upcoming as object);
  }

  function expectList(view: string, offset = 0): TestRequest {
    const req = http.expectOne((request) => request.url === LIST_URL && request.params.get('view') === view);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('view')).toBe(view);
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('offset')).toBe(String(offset));
    return req;
  }

  async function render(first: unknown = page([]), query: Record<string, string> = {}): Promise<void> {
    const params = new BehaviorSubject(convertToParamMap(query));
    await TestBed.configureTestingModule({
      imports: [MyReservationsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MyReservationsPage);
    fixture.detectChanges();
    if (first !== null) {
      expectList(query['vista'] === 'jugados' ? 'past' : 'upcoming').flush(first as object);
      await settle();
    }
  }

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('muestra tipos, estados, rol y nivel de reservas y partidos', async () => {
    await render(
      page([
        reservation('r-1'),
        reservation('r-2', { status: 'cancelled', cancellable: false }),
        match('m-1', { role: 'organizer' }),
        match('m-2', {}, { status: 'full', missingPlayers: 0, targetLevel: '6ta' }),
        match('m-3', { status: 'cancelled' }),
      ]),
    );
    const [active, cancelled, open, full, cancelledMatch] = cards();
    expect(active.textContent).toContain('Reserva');
    expect(active.textContent).toContain('Club Norte · Cancha 1');
    expect(active.textContent).toContain('Martes, 3 de noviembre');
    expect(active.textContent).toContain('18:00 a 19:30');
    expect(active.querySelector('[data-status]')?.textContent?.trim()).toBe('Reservada');
    expect(active.querySelector('[data-role]')).toBeNull();
    expect(cancelled.querySelector('[data-status]')?.textContent?.trim()).toBe('Cancelada');

    expect(open.textContent).toContain('Partido abierto');
    expect(open.querySelector('[data-status]')?.textContent?.trim()).toBe('Buscando jugadores · faltan 2');
    expect(open.querySelector('[data-role]')?.textContent?.trim()).toBe('Organizador');
    expect(open.querySelector('[data-level]')?.textContent?.trim()).toBe('Nivel 5ta');
    expect(full.querySelector('[data-status]')?.textContent?.trim()).toBe('Completo');
    expect(full.querySelector('[data-role]')?.textContent?.trim()).toBe('Jugador');
    expect(full.querySelector('[data-level]')?.textContent?.trim()).toBe('Nivel 6ta');
    expect(cancelledMatch.querySelector('[data-status]')?.textContent?.trim()).toBe('Cancelado');
  });

  it('muestra la hora en la zona del servidor y no en la del navegador', async () => {
    await render(page([reservation('r-1', { startsAt: '2026-11-03T21:00:00Z', endsAt: '2026-11-03T22:30:00Z' })]));
    expect(cards()[0].textContent).toContain('18:00 a 19:30');
  });

  it('ofrece Cancelar reserva solo cuando el servidor lo permite', async () => {
    await render(
      page([
        reservation('r-1'),
        reservation('r-2', { cancellable: false }),
        match('m-1', { role: 'organizer' }),
      ]),
    );
    const [first, second, third] = cards();
    expect(first.querySelector('.my-card__cancel')).toBeTruthy();
    expect(second.querySelector('.my-card__cancel')).toBeNull();
    expect(third.querySelector('.my-card__cancel')).toBeNull();
  });

  it('cancela con confirmación, avisa y recarga la lista', async () => {
    await render(page([reservation('r-1')]));
    buttonByText('Cancelar reserva')!.click();
    await settle();
    expect(text()).toContain('Si cancelás, el turno vuelve a quedar libre.');
    http.expectNone(`/api/v1/reservations/r-1/cancel`);

    (root().querySelector('.confirm-card .danger-button') as HTMLButtonElement).click();
    await settle();
    const cancel = http.expectOne('/api/v1/reservations/r-1/cancel');
    expect(cancel.request.method).toBe('POST');
    expect(cancel.request.body).toBeNull();
    cancel.flush({ reservation: { id: 'r-1', status: 'cancelled' } });
    await settle();
    expectList('upcoming').flush(page([reservation('r-1', { status: 'cancelled', cancellable: false })]));
    await settle();

    expect(toast()).toBe('Reserva cancelada.');
    expect(root().querySelector('app-confirm-dialog')).toBeNull();
    expect(cards()[0].querySelector('[data-status]')?.textContent?.trim()).toBe('Cancelada');
    expect(cards()[0].querySelector('.my-card__cancel')).toBeNull();
  });

  it('usa el id de la reserva y no el del partido al cancelar', async () => {
    await render(page([reservation('r-9', { id: 'r-9', reservationId: 'r-9' })]));
    buttonByText('Cancelar reserva')!.click();
    await settle();
    (root().querySelector('.confirm-card .danger-button') as HTMLButtonElement).click();
    await settle();
    http.expectOne('/api/v1/reservations/r-9/cancel').flush({ reservation: { id: 'r-9', status: 'cancelled' } });
    await settle();
    expectList('upcoming').flush(page([]));
  });

  it('permite volver desde la confirmación sin cancelar', async () => {
    await render(page([reservation('r-1')]));
    buttonByText('Cancelar reserva')!.click();
    await settle();
    buttonByText('Volver')!.click();
    await settle();
    expect(root().querySelector('app-confirm-dialog')).toBeNull();
    http.expectNone('/api/v1/reservations/r-1/cancel');
  });

  it('bloquea el doble envío de la cancelación', async () => {
    await render(page([reservation('r-1')]));
    buttonByText('Cancelar reserva')!.click();
    await settle();
    const confirm = root().querySelector('.confirm-card .danger-button') as HTMLButtonElement;
    confirm.click();
    confirm.click();
    await settle();
    const requests = http.match('/api/v1/reservations/r-1/cancel');
    expect(requests.length).toBe(1);
    requests[0].flush({ reservation: { id: 'r-1', status: 'cancelled' } });
    await settle();
    expectList('upcoming').flush(page([]));
  });

  it.each([
    [409, 'Ya no se puede cancelar: faltan menos de 4 horas.', true],
    [404, 'La reserva ya no existe.', true],
    [0, 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.', false],
    [500, 'No pudimos cancelar la reserva. Intentá nuevamente.', false],
  ])('traduce el error %i al cancelar', async (status, message, reloads) => {
    await render(page([reservation('r-1')]));
    buttonByText('Cancelar reserva')!.click();
    await settle();
    (root().querySelector('.confirm-card .danger-button') as HTMLButtonElement).click();
    await settle();
    const req = http.expectOne('/api/v1/reservations/r-1/cancel');
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({ error: 'x' }, { status, statusText: 'x' });
    await settle();
    expect(toast()).toBe(message);
    expect(root().querySelector('app-confirm-dialog')).toBeNull();
    if (reloads) {
      expectList('upcoming').flush(page([]));
      await settle();
    }
  });

  it('muestra el vacío de cada pestaña con enlaces a partidos y clubes', async () => {
    await render(page([]));
    expect(root().querySelector('.my-state a[href="/partidos"]')).toBeNull();
    expect(root().querySelector('.my-state a[href="/clubes"]')).toBeNull();
    expect(text()).toContain('Todavía no tenés reservas próximas.');
    expect(root().querySelector('a[href="/partidos"]')).toBeTruthy();
    expect(root().querySelector('a[href="/clubes"]')).toBeTruthy();

    buttonByText('Jugados')!.click();
    await settle();
    expectList('past').flush(page([]));
    await settle();
    expect(root().querySelector('.my-state a[href="/partidos"]')).toBeNull();
    expect(root().querySelector('.my-state a[href="/clubes"]')).toBeNull();
    expect(text()).toContain('Todavía no jugaste ningún partido.');
  });

  it('cambia de pestaña, consulta la vista pasada y actualiza la URL', async () => {
    await render(page([reservation('r-1')]));
    const tabs = [...root().querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);

    tabs[1].click();
    await settle();
    expect(text()).toContain('Cargando tus reservas');
    expectList('past').flush(page([match('m-1', { status: 'reserved' })]));
    await settle();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(cards().length).toBe(1);
    expect(cards()[0].textContent).toContain('Partido abierto');
    expect(navigate).toHaveBeenCalledWith([], { queryParams: { vista: 'jugados' }, replaceUrl: true });
  });

  it('en Jugados la tarjeta Próximo turno muestra el próximo turno de los próximos', async () => {
    await render(null, { vista: 'jugados' });
    expectList('past').flush(page([]));
    flushNextTurn(page([reservation('r-9')]));
    await settle();
    expect(root().querySelector('.next-card')?.textContent).not.toContain('Todav');
    expect(root().querySelector('.next-card__countdown')).not.toBeNull();
  });

  it('abre directamente la pestaña indicada en la URL', async () => {
    await render(page([match('m-1')]), { vista: 'jugados' });
    expect(root().querySelector('#tab-jugados')?.getAttribute('aria-selected')).toBe('true');
    expect(root().querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('tab-jugados');
  });

  it('ignora la respuesta de una pestaña anterior si se cambió antes de terminar', async () => {
    await render(null);
    const first = expectList('upcoming');
    buttonByText('Jugados')!.click();
    await settle();
    const second = expectList('past');
    second.flush(page([match('m-1')]));
    await settle();
    expect(first.cancelled).toBe(true);
    expect(cards().length).toBe(1);
  });

  it('pagina con Ver más usando el offset y agrega resultados sin duplicar', async () => {
    await render(page([reservation('r-1'), reservation('r-2')], true));
    expect(buttonByText('Ver más')).toBeTruthy();
    buttonByText('Ver más')!.click();
    await settle();
    expectList('upcoming', 2).flush(page([reservation('r-2'), reservation('r-3')], false, 2));
    await settle();
    expect(cards().length).toBe(3);
    expect(buttonByText('Ver más')).toBeUndefined();
  });

  it('informa si falla "Ver más" y conserva lo cargado', async () => {
    await render(page([reservation('r-1')], true));
    buttonByText('Ver más')!.click();
    await settle();
    expectList('upcoming', 1).flush({ error: 'x' }, { status: 500, statusText: 'x' });
    await settle();
    expect(toast()).toContain('No pudimos cargar más');
    expect(cards().length).toBe(1);
    expect(buttonByText('Ver más')).toBeTruthy();
  });

  it('muestra el error de carga y vuelve a consultar al reintentar', async () => {
    await render(null);
    expectList('upcoming').flush({ error: 'x' }, { status: 500, statusText: 'x' });
    await settle();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tus reservas');
    buttonByText('Reintentar')!.click();
    await settle();
    expectList('upcoming').flush(page([reservation('r-1')]));
    await settle();
    expect(cards().length).toBe(1);
  });

  it('trata una respuesta con forma inválida como error de carga', async () => {
    await render(null);
    expectList('upcoming').flush({ items: [{ kind: 'otro' }], page: { limit: 20, offset: 0, hasMore: false } });
    await settle();
    expect(root().querySelector('[role="alert"]')).toBeTruthy();
  });
});
