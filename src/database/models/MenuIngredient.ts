import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class MenuIngredient extends Model {
  static table = 'menu_ingredients';

  @field('menu_item_id') menuItemId!: string;
  @field('material_id') materialId!: string;
  @field('material_name') materialName!: string;
  @field('quantity') quantity!: string;
  @field('unit') unit!: string;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
