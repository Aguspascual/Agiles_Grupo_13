import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbsenceReportsComponent } from './absence-reports.component';

describe('HU-19: panel de ausencias', () => {
  let fixture: ComponentFixture<AbsenceReportsComponent>;
  let http: HttpTestingController;
  const body = (overrides: Record<string, unknown> = {}) => ({
    matchId: 'm-1', endsAt: '2026-11-03T19:30:00-03:00', deadline: '2026-11-05T19:30:00-03:00',
    serverNow: '2026-11-04T10:00:00-03:00', windowOpen: true,
    players: [
      { id: 'u-1', name: 'Ana', isSelf: true, reportCount: 0, confirmed: false, reportedByMe: false, canReport: false },
      { id: 'u-2', name: 'Beto', isSelf: false, reportCount: 1, confirmed: false, reportedByMe: false, canReport: true },
      { id: 'u-3', name: 'Cami', isSelf: false, reportCount: 2, confirmed: true, reportedByMe: false, canReport: true },
    ], ...overrides,
  });
  const root = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) => [...root().querySelectorAll('button')].find(item => item.textContent?.trim() === label) as HTMLButtonElement | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AbsenceReportsComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AbsenceReportsComponent);
    fixture.componentRef.setInput('matchId', 'm-1');
    fixture.detectChanges();
  });
  afterEach(() => { http.verify(); fixture.destroy(); });

  it('consulta por demanda, muestra estado, vencimiento, autorreporte y no revela reportantes', () => {
    button('Consultar ausencias')!.click(); fixture.detectChanges();
    expect(root().textContent).toContain('Consultando participantes');
    const req = http.expectOne('/api/v1/matches/m-1/absence-reports');
    expect(req.request.method).toBe('GET'); req.flush(body()); fixture.detectChanges();
    expect(root().textContent).toContain('Plazo vigente hasta');
    expect(root().textContent).toContain('Ana (vos)');
    expect(root().textContent).toContain('1/2');
    expect(root().textContent).toContain('Ausencia confirmada');
    expect(root().textContent).not.toContain('reporter');
    expect(root().querySelectorAll('button').length).toBe(3);
  });

  it('solicita confirmación y actualiza el estado con un único POST', () => {
    button('Consultar ausencias')!.click(); fixture.detectChanges();
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush(body()); fixture.detectChanges();
    button('Reportar ausencia')!.click(); fixture.detectChanges();
    expect(root().textContent).toContain('¿Confirmás que este jugador estuvo ausente?');
    http.expectNone(request => request.method === 'POST');
    const confirm = button('Confirmar reporte')!;
    confirm.click(); confirm.click(); fixture.detectChanges();
    const requests = http.match(request => request.method === 'POST' && request.url === '/api/v1/matches/m-1/absence-reports');
    expect(requests.length).toBe(1);
    expect(requests[0].request.body).toEqual({ playerId: 'u-2' });
    const updated = body({ players: body().players.map((player: {id:string}) => player.id === 'u-2' ? { ...player, reportCount: 1, reportedByMe: true, canReport: false } : player) });
    requests[0].flush(updated, { status: 201, statusText: 'Created' }); fixture.detectChanges();
    expect(root().textContent).toContain('Ya reportaste');
    const beto = [...root().querySelectorAll('li')].find(item => item.textContent?.includes('Beto'))!;
    expect(beto.querySelector('button')).toBeNull();
    expect([...root().querySelectorAll('li')].find(item => item.textContent?.includes('Cami'))?.querySelector('button')).toBeTruthy();
    http.expectNone(request => request.method === 'GET');
  });

  it('permite consultar tras vencer, pero oculta acciones de reporte', () => {
    button('Consultar ausencias')!.click(); fixture.detectChanges();
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush(body({ windowOpen: false, players: body().players.map((player: {canReport:boolean}) => ({...player, canReport:false})) })); fixture.detectChanges();
    expect(root().textContent).toContain('Plazo vencido el');
    expect(root().textContent).toContain('Podés consultar el estado.');
    expect(button('Reportar ausencia')).toBeUndefined();
  });

  it('maneja error HTTP con reintento y error de permisos', () => {
    button('Consultar ausencias')!.click(); fixture.detectChanges();
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush({}, { status: 403, statusText: 'Forbidden' }); fixture.detectChanges();
    expect(root().textContent).toContain('Solo quienes participaron pueden consultar este partido.');
    button('Reintentar')!.click(); fixture.detectChanges();
    http.expectOne('/api/v1/matches/m-1/absence-reports').flush({}, { status: 500, statusText: 'Server Error' }); fixture.detectChanges();
    expect(root().textContent).toContain('No pudimos consultar las ausencias.');
  });
});
