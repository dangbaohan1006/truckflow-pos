import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';

export default class InventoryItem extends Model {
  static table = 'inventory_items';

  @text('name') name!: string;
  @text('sku') sku!: string;
  @text('unit') unit!: string;
  @text('quantity') quantity!: string;
  @text('reorder_level') reorderLevel!: string;
  @text('price') price!: string;
  @text('category') category!: string;
  @field('is_raw_material') isRawMaterial!: boolean;
  @text('location_type') locationType!: string;
  @text('truck_id') truckId!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
