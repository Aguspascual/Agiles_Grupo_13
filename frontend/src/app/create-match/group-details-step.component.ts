import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ReservationGroup } from '../bookings/booking.model';

@Component({
  selector: 'app-group-details-step',
  imports: [ReactiveFormsModule],
  templateUrl: './group-details-step.component.html',
  styleUrl: './group-details-step.component.scss',
})
export class GroupDetailsStepComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly initialGroup = input<ReservationGroup | null>(null);
  readonly accountName = input('Lucas M.');
  readonly groupChange = output<ReservationGroup | null>();
  readonly players = signal(1);
  readonly playerCount = computed(() => this.players());
  readonly form = new FormGroup({
    responsibleName: new FormControl('Lucas M.', { nonNullable: true, validators: [trimmedNameValidator()] }),
    contactPhone: new FormControl('', { nonNullable: true }),
    player1: new FormControl('Lucas M.', { nonNullable: true, validators: [trimmedNameValidator()] }),
    player2: new FormControl('', { nonNullable: true, validators: [trimmedNameValidator()] }),
    player3: new FormControl('', { nonNullable: true, validators: [trimmedNameValidator()] }),
    player4: new FormControl('', { nonNullable: true, validators: [trimmedNameValidator()] }),
  });

  ngOnInit(): void {
    const group = this.initialGroup();
    if (group) {
      this.form.patchValue({
        responsibleName: group.responsibleName,
        contactPhone: group.contactPhone,
        player1: group.players[0],
        player2: group.players[1],
        player3: group.players[2],
        player4: group.players[3],
      });
    }
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emitGroup());
    this.emitGroup();
  }

  private emitGroup(): void {
    this.form.controls.responsibleName.setValue(this.accountName(), { emitEvent: false });
    this.form.controls.player1.setValue(this.accountName(), { emitEvent: false });
    const value = this.form.getRawValue();
    this.players.set([value.player1, value.player2, value.player3, value.player4]
      .filter((name) => name.trim().length > 0).length);
    if (this.form.invalid) {
      this.groupChange.emit(null);
      return;
    }
    this.groupChange.emit({
      responsibleName: value.responsibleName.trim(),
      contactPhone: value.contactPhone.trim(),
      players: [value.player1.trim(), value.player2.trim(), value.player3.trim(), value.player4.trim()],
    });
  }
}

function trimmedNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return { required: true };
    return value.length < 2 ? { minlength: { requiredLength: 2, actualLength: value.length } } : null;
  };
}
