import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class StockMovement extends Model {
  static table = 'stock_movements';

  @text('item_id') itemId!: string;
  @text('item_name') itemName!: string;
  @text('quantity') quantity!: string;
  @text('type') type!: string;
  @text('reference_id') referenceId!: string;
  @text('note') note!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
