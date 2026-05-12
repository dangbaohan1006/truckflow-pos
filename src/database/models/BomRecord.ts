import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class BomRecord extends Model {
  static table = 'bom_records';

  @text('product_id') productId!: string;
  @text('product_name') productName!: string;
  @text('material_id') materialId!: string;
  @text('material_name') materialName!: string;
  @text('quantity') quantity!: string;
  @text('unit') unit!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
