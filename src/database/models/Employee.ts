import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Employee extends Model {
  static table = 'employees';

  @text('name') name!: string;
  @text('phone') phone!: string;
  @text('role') role!: string;
  @text('salary') salary!: string;
  @text('status') status!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
