import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Truck extends Model {
  static table = 'trucks';

  @text('name') name!: string;
  @text('code') code!: string;
  @text('status') status!: string;
  @text('location') location!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
