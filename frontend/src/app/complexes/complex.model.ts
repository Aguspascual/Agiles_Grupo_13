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
  managerIds: string[];
}

export type ComplexDraft = Omit<ComplexRecord, 'id'>;
export type DemoRole = 'admin' | 'manager';
