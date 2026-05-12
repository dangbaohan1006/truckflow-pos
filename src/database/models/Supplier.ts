import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Supplier extends Model {
  static table = 'suppliers';

  @text('name') name!: string;
  @text('phone') phone!: string;
  @text('address') address!: string;
  @text('note') note!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
