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
  /** Ruta de la imagen del complejo; solo existe si el complejo cargó una. */
  imageUrl?: string;
}

/** Cancha publicada junto con los datos del complejo al que pertenece. */
export interface PublicCourt {
  id: string;
  name: string;
  covered: boolean;
  features: string[];
  imageUrl?: string;
  complexId: string;
  complexName: string;
  complexZone: string;
  complexAddress: string;
}

export type ComplexDraft = Omit<ComplexRecord, 'id'>;
export type DemoRole = 'admin' | 'manager';
