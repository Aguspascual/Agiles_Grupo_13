import { Injectable, signal } from '@angular/core';
import { ComplexDraft, ComplexRecord, DemoRole, ManagerOption } from './complex.model';

@Injectable({ providedIn: 'root' })
export class ComplexPreviewStore {
  readonly managers: ManagerOption[] = [
    { id: 'manager-ana', name: 'Ana Martínez', email: 'ana@ejemplo.com' },
    { id: 'manager-mateo', name: 'Mateo Ruiz', email: 'mateo@ejemplo.com' },
    { id: 'manager-lucia', name: 'Lucía Fernández', email: 'lucia@ejemplo.com' },
  ];

  readonly complexes = signal<ComplexRecord[]>([
    {
      id: 'complex-gonnet',
      name: 'Club Universitario Gonnet',
      address: 'Calle 14 y 501',
      zone: 'Gonnet',
      phone: '221 555-0142',
      managerIds: ['manager-ana', 'manager-mateo'],
    },
    {
      id: 'complex-centro',
      name: 'Punto Pádel La Plata',
      address: 'Diagonal 74 1280',
      zone: 'Casco Urbano',
      phone: '221 555-0188',
      managerIds: ['manager-lucia'],
    },
    // HU-05: clubes del directorio público, para que "Explorar turnos" abra su grilla.
    {
      id: 'complex-cumbre',
      name: 'La Cumbre Pádel',
      address: 'Calle 131 y 32',
      zone: 'San Carlos',
      phone: '221 555-0150',
      managerIds: ['manager-mateo'],
    },
    {
      id: 'complex-citybell',
      name: 'City Bell Padel Hub',
      address: 'Camino Centenario 4462',
      zone: 'City Bell',
      phone: '221 555-0163',
      managerIds: ['manager-lucia'],
    },
    {
      id: 'complex-estudiantes',
      name: 'Estudiantes de La Plata',
      address: 'Calle 53 y 7',
      zone: 'Casco Urbano',
      phone: '221 555-0177',
      managerIds: ['manager-lucia'],
    },
  ]);

  forActor(role: DemoRole, managerId: string): ComplexRecord[] {
    const all = this.complexes();
    return role === 'admin' ? all : all.filter(complex => complex.managerIds.includes(managerId));
  }

  create(draft: ComplexDraft): void {
    this.complexes.update(records => [...records, { ...draft, id: crypto.randomUUID() }]);
  }

  update(id: string, draft: ComplexDraft): void {
    this.complexes.update(records => records.map(complex => complex.id === id ? { ...draft, id } : complex));
  }

  remove(id: string): void {
    this.complexes.update(records => records.filter(complex => complex.id !== id));
  }
}
