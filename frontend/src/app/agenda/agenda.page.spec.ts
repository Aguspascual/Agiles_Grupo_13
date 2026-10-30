import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CLOCK } from '../slot-grid/slot-grid.service';
import { AgendaPage } from './agenda.page';

// Miércoles 21/10/2026, 20:18.
const NOW = new Date(2026, 9, 21, 20, 18);
const BASE = '/api/v1/complexes/complex-1';
const AGENDA_URL = `${BASE}/agenda`;

const reservation = (id: string, origin: 'web' | 'manual' | 'open_match', name: string, startsAt: string, endsAt: string, cancellable: boolean) => ({
  id,
  origin,
  startsAt,
  endsAt,
  originalStartsAt: `2026-10-21T${startsAt}:00-03:00`,
  originalEndsAt: `2026-10-21T${endsAt}:00-03:00`,
  contact: { name, phone: origin === 'open_match' ? '' : `221-${id}` },
  cancellable,
});

function agendaBody() {
  const slot = (startsAt: string, endsAt: string, status: string, isPast = false, reservationId?: string) => ({
    id: `k1:2026-10-21:${startsAt}`,
    startsAt,
    endsAt,
    status,
    isPast,
    ...(reservationId ? { reservationId } : {}),
  });
  return {
    complex: { id: 'complex-1', name: 'Club Norte', address: 'Calle 1', zone: 'Gonnet' },
    date: '2026-10-21',
    courts: [
      {
        id: 'k1',
        name: 'Cancha 1',
        covered: true,
        slots: [
          slot('16:30', '18:00', 'AVAILABLE', true),
          slot('18:00', '19:30', 'RESERVED', true, 'r-web'),
          slot('19:30', '21:00', 'AVAILABLE'),
          slot('21:00', '22:30', 'RESERVED', false, 'r-done'),
          slot('22:30', '24:00', 'BLOCKED'),
        ],
        reservations: [
          reservation('r-web', 'web', 'Ana Pérez', '18:00', '19:30', true),
          reservation('r-done', 'manual', 'Luis Gómez', '21:00', '22:30', false),
          reservation('r-off', 'manual', 'Marta Díaz', '08:00', '09:00', true),
        ],
      },
    ],
  };
}

describe('HU-07: agenda del complejo', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AgendaPage>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const toast = () => root().querySelector('.toast p')?.textContent ?? '';

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function expectAgenda(): TestRequest {
    const req = http.expectOne((request) => request.url === AGENDA_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date')).toBe('2026-10-21');
    return req;
  }

  async function render(respond: unknown = agendaBody()): Promise<void> {
    const params = new BehaviorSubject(convertToParamMap({ complexId: 'complex-1' }));
    const query = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [AgendaPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CLOCK, useValue: () => NOW },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params, queryParamMap: query, snapshot: { paramMap: params.value, queryParamMap: query.value } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AgendaPage);
    fixture.detectChanges();
    if (respond !== null) {
      expectAgenda().flush(respond as object);
      await settle();
    }
  }

  const cell = (label: string) =>
    [...root().querySelectorAll<HTMLElement>('.slot-cell')].find((item) => item.getAttribute('aria-label')?.includes(label));
  const click = async (element: Element | null | undefined) => {
    expect(element).toBeTruthy();
    (element as HTMLElement).click();
    await settle();
  };
  const button = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('.agenda-panel button')].find((item) => item.textContent?.trim() === label);

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('muestra quién reservó cada turno con nombre, teléfono y origen', async () => {
    await render();
    const web = cell('18:00 a 19:30')!;
    expect(web.textContent).toContain('Ana Pérez');
    expect(web.textContent).toContain('221-r-web');
    expect(web.textContent).toContain('Web');
    const manual = cell('21:00 a 22:30')!;
    expect(manual.textContent).toContain('Luis Gómez');
    expect(manual.textContent).toContain('Manual');
    expect(cell('19:30 a 21:00')!.textContent).toContain('Libre');
    expect(cell('22:30 a 24:00')!.textContent).toContain('No disponible');
  });

  it('muestra el partido abierto con su chip y "—" cuando no hay teléfono', async () => {
    const body = agendaBody();
    body.courts[0].reservations[0] = reservation('r-web', 'open_match', 'Ana Pérez', '18:00', '19:30', true);
    await render(body);
    const open = cell('18:00 a 19:30')!;
    expect(open.textContent).toContain('Partido abierto');
    expect(open.querySelector('.origin-chip')?.classList.contains('is-open_match')).toBe(true);
    expect(open.querySelector('.cell-phone')?.textContent?.trim()).toBe('—');
    expect(text()).not.toContain('Cargando agenda');
  });

  it('no promete aviso al cancelar un partido abierto', async () => {
    const body = agendaBody();
    body.courts[0].reservations[0] = reservation('r-web', 'open_match', 'Ana Pérez', '18:00', '19:30', true);
    await render(body);
    await click(cell('18:00 a 19:30'));
    await click(button('Cancelar reserva'));
    expect(text()).toContain('El partido abierto se cancelará.');
    expect(text()).not.toContain('Se avisará al jugador.');
  });

  const pendingMatch = (missingPlayers: number, names: string[]) => ({
    id: 'm1',
    status: missingPlayers === 0 ? 'full' : 'open',
    targetLevel: '5ta',
    missingPlayers,
    players: names.map((name, index) => ({
      name,
      level: index === 0 ? '5ta' : '6ta',
      ...(index === 0 ? { position: 'Drive' } : {}),
      organizer: index === 0,
    })),
  });

  function openMatchBody(match: ReturnType<typeof pendingMatch>, index = 0) {
    const body = agendaBody();
    body.courts[0].reservations[index] = {
      ...reservation(body.courts[0].reservations[index].id, 'open_match', match.players[0].name, '18:00', '19:30', true),
      pendingMatch: match,
    } as never;
    return body;
  }

  it('muestra en la celda del partido abierto el organizador y cuántos faltan', async () => {
    await render(openMatchBody(pendingMatch(2, ['Ana Pérez', 'Luis Gómez'])));
    const open = cell('18:00 a 19:30')!;
    expect(open.textContent).toContain('Ana Pérez');
    expect(open.textContent).toContain('Partido abierto');
    expect(open.querySelector('.cell-missing')?.textContent?.trim()).toBe('Faltan 2');
    expect(open.querySelector('.cell-phone')).toBeNull();
  });

  it('muestra "Falta 1" y "Completo" según los lugares libres', async () => {
    await render(openMatchBody(pendingMatch(1, ['Ana Pérez', 'Luis Gómez', 'Eva Díaz'])));
    expect(cell('18:00 a 19:30')!.querySelector('.cell-missing')?.textContent?.trim()).toBe('Falta 1');
    fixture.destroy();
    TestBed.resetTestingModule();

    await render(openMatchBody(pendingMatch(0, ['Ana Pérez', 'Luis Gómez', 'Eva Díaz', 'Dan Ruiz'])));
    expect(cell('18:00 a 19:30')!.querySelector('.cell-missing')?.textContent?.trim()).toBe('Completo');
  });

  it('lista los anotados en el panel con nivel, posición y marca de organizador', async () => {
    await render(openMatchBody(pendingMatch(2, ['Ana Pérez', 'Luis Gómez'])));
    await click(cell('18:00 a 19:30'));
    const panel = root().querySelector('.agenda-panel')!;
    expect(panel.textContent).toContain('Anotados (2 de 4)');
    expect(panel.textContent).toContain('Nivel buscado: 5ta');
    const items = [...panel.querySelectorAll('.match-players li')];
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Ana Pérez');
    expect(items[0].textContent).toContain('5ta');
    expect(items[0].textContent).toContain('Drive');
    expect(items[0].textContent).toContain('Organizador');
    expect(items[1].textContent).toContain('Luis Gómez');
    expect(items[1].textContent).toContain('6ta');
    expect(items[1].textContent).not.toContain('Organizador');
    expect(panel.querySelector('.missing-tag')?.textContent?.trim()).toBe('Faltan 2');
  });

  it('muestra el resumen compacto del partido en las reservas fuera de la grilla', async () => {
    await render(openMatchBody(pendingMatch(2, ['Marta Díaz', 'Pablo Sosa']), 2));
    const section = root().querySelector('.agenda-offgrid')!;
    expect(section.querySelector('.agenda-offgrid__match')?.textContent).toContain('Faltan 2');
    expect(section.querySelector('.agenda-offgrid__match')?.textContent).toContain('Marta Díaz, Pablo Sosa');
  });

  it('informa cuántos anotados hay al cancelar y aclara que no se les avisa', async () => {
    await render(openMatchBody(pendingMatch(1, ['Ana Pérez', 'Luis Gómez', 'Eva Díaz'])));
    await click(cell('18:00 a 19:30'));
    await click(button('Cancelar reserva'));
    const message = root().querySelector('.confirm-card')?.textContent ?? '';
    expect(message).toContain('El partido tiene 3 jugadores anotados.');
    expect(message).toContain('Se cancelará y se liberará el turno; por ahora no se les avisa.');
    expect(message).not.toContain('Se avisará');
  });

  it('deja intactas las reservas web y manual: sin lista de anotados ni faltantes', async () => {
    await render(openMatchBody(pendingMatch(2, ['Ana Pérez', 'Luis Gómez']), 2));
    const web = cell('18:00 a 19:30')!;
    expect(web.querySelector('.cell-missing')).toBeNull();
    expect(web.querySelector('.cell-phone')?.textContent).toContain('221-r-web');
    await click(web);
    expect(root().querySelector('.match-players')).toBeNull();
    expect(root().querySelector('.agenda-panel')?.textContent).not.toContain('Anotados');
  });

  it('atenúa los turnos pasados y no deja elegirlos', async () => {
    await render();
    const past = cell('16:30 a 18:00')!;
    expect(past.tagName).toBe('DIV');
    expect(past.classList.contains('is-past')).toBe(true);
  });

  it('solo permite elegir reservas cancelables y turnos libres', async () => {
    await render();
    expect(cell('21:00 a 22:30')!.tagName).toBe('DIV');
    expect(cell('22:30 a 24:00')!.tagName).toBe('DIV');
    expect(cell('18:00 a 19:30')!.tagName).toBe('BUTTON');
    expect(cell('19:30 a 21:00')!.tagName).toBe('BUTTON');
  });

  it('ofrece Registrar reserva en un turno libre y Cancelar reserva en uno reservado', async () => {
    await render();
    await click(cell('19:30 a 21:00'));
    expect(button('Registrar reserva')).toBeTruthy();
    expect(button('Cancelar reserva')).toBeUndefined();

    await click(cell('18:00 a 19:30'));
    expect(button('Cancelar reserva')).toBeTruthy();
    expect(button('Registrar reserva')).toBeUndefined();
    expect(text()).toContain('Ana Pérez');
  });

  it('lista las reservas fuera de la grilla actual y permite cancelarlas', async () => {
    await render();
    const section = root().querySelector('.agenda-offgrid')!;
    expect(section.textContent).toContain('Reservas fuera de la grilla actual');
    expect(section.textContent).toContain('Marta Díaz');
    expect(section.textContent).not.toContain('Luis Gómez');
    expect(section.querySelectorAll('button').length).toBe(1);
  });

  it('cancela una reserva web avisando al jugador, muestra el aviso y recarga', async () => {
    await render();
    await click(cell('18:00 a 19:30'));
    await click(button('Cancelar reserva'));
    expect(text()).toContain('Se avisará al jugador.');

    await click(root().querySelector('.confirm-card .danger-button'));
    const cancel = http.expectOne(`${BASE}/reservations/r-web/cancel`);
    expect(cancel.request.method).toBe('POST');
    expect(cancel.request.body).toBeNull();
    cancel.flush({ reservation: { id: 'r-web', status: 'cancelled' } });
    await settle();
    expectAgenda().flush(agendaBody());
    await settle();
    expect(toast()).toBe('Reserva cancelada. Se avisó al jugador.');
  });

  it('no promete aviso al cancelar una reserva manual', async () => {
    await render();
    await click(root().querySelector('.agenda-offgrid button'));
    expect(text()).not.toContain('Se avisará al jugador.');
    expect(text()).toContain('Marta Díaz');
    await click(root().querySelector('.confirm-card .danger-button'));
    http.expectOne(`${BASE}/reservations/r-off/cancel`).flush({ reservation: { id: 'r-off', status: 'cancelled' } });
    await settle();
    expectAgenda().flush(agendaBody());
    await settle();
    expect(toast()).toBe('Reserva cancelada.');
  });

  it('bloquea el doble envío de la cancelación', async () => {
    await render();
    await click(cell('18:00 a 19:30'));
    await click(button('Cancelar reserva'));
    const page = fixture.componentInstance;
    page.confirmCancel();
    page.confirmCancel();
    const request = http.expectOne(`${BASE}/reservations/r-web/cancel`);
    request.flush({ reservation: { id: 'r-web', status: 'cancelled' } });
    await settle();
    expectAgenda().flush(agendaBody());
  });

  for (const [status, message, reloads] of [
    [409, 'La reserva ya finalizó.', true],
    [404, 'La reserva ya no existe.', true],
    [403, 'No tenés permisos para esta acción.', false],
    [0, 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.', false],
  ] as const) {
    it(`traduce el error ${status} al cancelar`, async () => {
      await render();
      await click(cell('18:00 a 19:30'));
      await click(button('Cancelar reserva'));
      await click(root().querySelector('.confirm-card .danger-button'));
      const request = http.expectOne(`${BASE}/reservations/r-web/cancel`);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ error: 'x' }, { status, statusText: 'Error' });
      await settle();
      if (reloads) {
        expectAgenda().flush(agendaBody());
        await settle();
      }
      expect(toast()).toBe(message);
    });
  }

  async function openManualDialog(): Promise<void> {
    await click(cell('19:30 a 21:00'));
    await click(button('Registrar reserva'));
    expect(root().querySelector('app-manual-reservation-dialog')).toBeTruthy();
    const name = root().querySelector<HTMLInputElement>('#manual-name')!;
    name.value = ' Luis Gómez ';
    name.dispatchEvent(new Event('input'));
    const phone = root().querySelector<HTMLInputElement>('#manual-phone')!;
    phone.value = '221 555 0102';
    phone.dispatchEvent(new Event('input'));
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  it('registra una reserva manual con el body exacto y recarga la agenda', async () => {
    await render();
    await openManualDialog();
    const request = http.expectOne(`${BASE}/courts/k1/manual-reservations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      date: '2026-10-21',
      startsAt: '19:30',
      contact: { name: 'Luis Gómez', phone: '221 555 0102' },
    });
    request.flush({ reservation: { id: 'n', status: 'reserved' } }, { status: 201, statusText: 'Created' });
    await settle();
    expectAgenda().flush(agendaBody());
    await settle();
    expect(toast()).toBe('Reserva registrada.');
    expect(root().querySelector('app-manual-reservation-dialog')).toBeNull();
  });

  it('no envía dos veces la reserva manual', async () => {
    await render();
    await openManualDialog();
    const dialog = root().querySelector('form')!;
    dialog.dispatchEvent(new Event('submit'));
    fixture.componentInstance.registerManual({ name: 'Otro', phone: '1' });
    const request = http.expectOne(`${BASE}/courts/k1/manual-reservations`);
    request.flush({ reservation: { id: 'n', status: 'reserved' } }, { status: 201, statusText: 'Created' });
    await settle();
    expectAgenda().flush(agendaBody());
  });

  it('avisa que el turno ya no está disponible ante un 409 y recarga', async () => {
    await render();
    await openManualDialog();
    http.expectOne(`${BASE}/courts/k1/manual-reservations`).flush({ error: 'turno no disponible' }, { status: 409, statusText: 'Conflict' });
    await settle();
    expectAgenda().flush(agendaBody());
    await settle();
    expect(toast()).toBe('Ese turno ya no está disponible.');
    expect(root().querySelector('app-manual-reservation-dialog')).toBeNull();
  });

  for (const [status, message] of [
    [400, 'Revisá los datos.'],
    [403, 'No tenés permisos para esta acción.'],
    [0, 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.'],
  ] as const) {
    it(`traduce el error ${status} al registrar y mantiene el diálogo`, async () => {
      await render();
      await openManualDialog();
      const request = http.expectOne(`${BASE}/courts/k1/manual-reservations`);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ error: 'x' }, { status, statusText: 'Error' });
      await settle();
      expect(toast()).toBe(message);
      expect(root().querySelector('app-manual-reservation-dialog')).toBeTruthy();
    });
  }

  it('informa la falta de permisos (403)', async () => {
    await render(null);
    expectAgenda().flush({ error: 'sin permisos' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(text()).toContain('No tenés permisos sobre este complejo.');
  });

  it('informa que el complejo no existe (404)', async () => {
    await render(null);
    expectAgenda().flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toContain('No encontramos este complejo');
  });

  it('muestra el error de conexión y vuelve a consultar al reintentar', async () => {
    await render(null);
    expectAgenda().flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text()).toContain('No pudimos cargar la agenda');
    await click(root().querySelector('.agenda-message button'));
    expectAgenda().flush(agendaBody());
    await settle();
    expect(cell('18:00 a 19:30')).toBeTruthy();
  });

  it('al recargar otro día mantiene la pantalla y solo atenúa la grilla', async () => {
    await render();
    const page = fixture.componentInstance as unknown as { load(id: string, date: string, silent: boolean): void };

    page.load('complex-1', '2026-10-22', false);
    fixture.detectChanges();
    expect(text()).not.toContain('Cargando agenda');
    expect(cell('18:00 a 19:30')).toBeTruthy();
    expect(root().querySelector('.agenda-board')?.classList.contains('is-refreshing')).toBe(true);

    const req = http.expectOne((request) => request.url === AGENDA_URL);
    expect(req.request.params.get('date')).toBe('2026-10-22');
    req.flush(agendaBody());
    await settle();
    expect(root().querySelector('.agenda-board')?.classList.contains('is-refreshing')).toBe(false);
  });});
