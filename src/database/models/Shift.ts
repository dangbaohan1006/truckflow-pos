import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Shift extends Model {
  static table = 'shifts';

  @text('truck_id') truckId!: string;
  @text('staff_name') staffName!: string;
  @text('opening_balance') openingBalance!: string;
  @text('closing_balance') closingBalance!: string;
  @text('expected_balance') expectedBalance!: string;
  @text('difference') difference!: string;
  @text('status') status!: string;
  @field('opened_at') openedAt!: number;
  @field('closed_at') closedAt!: number;
  @text('note') note!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
