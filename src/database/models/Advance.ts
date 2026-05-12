import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Advance extends Model {
  static table = 'advances';

  @text('employee_id') employeeId!: string;
  @text('employee_name') employeeName!: string;
  @text('amount') amount!: string;
  @text('note') note!: string;
  @field('date') date!: number;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
