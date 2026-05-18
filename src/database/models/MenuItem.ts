import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class MenuItem extends Model {
  static table = 'menu_items';

  @field('name') name!: string;
  @field('price') price!: string;
  @field('category') category!: string;
  @field('unit') unit!: string;
  @field('default_discount') defaultDiscount!: string;
  @field('discount_start') discountStart!: number;
  @field('discount_end') discountEnd!: number;
  @field('is_active') isActive!: boolean;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
