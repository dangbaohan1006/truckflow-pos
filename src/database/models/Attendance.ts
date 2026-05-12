import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Attendance extends Model {
  static table = 'attendance';

  @text('employee_id') employeeId!: string;
  @field('date') date!: number;
  @field('check_in') checkIn!: number;
  @field('check_out') checkOut!: number;
  @text('note') note!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
