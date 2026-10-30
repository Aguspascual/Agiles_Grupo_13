export interface ManagerOption {
  id: string;
  name: string;
  email: string;
}

export interface ComplexRecord {
  id: string;
  name: string;
  address: string;
  zone: string;
  phone: string;
  imageDataUrl: string | null;
  managerIds: string[];
  managers?: ManagerOption[];
}

/** Complejo del listado público (sin teléfono ni encargados). */
export interface PublicComplex {
  id: string;
  name: string;
  address: string;
  zone: string;
}

export type ComplexDraft = Omit<ComplexRecord, 'id'>;
export type DemoRole = 'admin' | 'manager';
