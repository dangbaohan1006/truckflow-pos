import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, relation } from '@nozbe/watermelondb/decorators';
import SalesOrder from './SalesOrder';
import InventoryItem from './InventoryItem';

export default class SalesOrderLine extends Model {
  static table = 'pos_order_line';

  @text('order_id') orderId!: string;
  @text('product_id') productId!: string;
  @text('product_name') productName!: string;
  @text('quantity') quantity!: string;
  @text('price') price!: string;
  @text('subtotal') subtotal!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;

  @relation('pos_order', 'order_id') order!: SalesOrder;
  @relation('inventory_items', 'product_id') item!: InventoryItem;
}
