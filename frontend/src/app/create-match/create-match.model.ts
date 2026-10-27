import { GridSlot } from '../slot-grid/slot-grid.model';

export interface ReservationSelection {
  complexId: string;
  complexName: string;
  courtId: string;
  courtName: string;
  slot: GridSlot;
}
