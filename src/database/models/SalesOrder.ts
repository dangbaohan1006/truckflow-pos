import { Model } from '@nozbe/watermelondb';
import { children, field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class SalesOrder extends Model {
  static table = 'pos_order';

  @children('pos_order_line') orderLines!: any;

  @text('total_amount') totalAmount!: string;
  @text('status') status!: string;
  @text('payment_method') paymentMethod!: string;
  @text('cash_received') cashReceived!: string;
  @text('change_amount') changeAmount!: string;
  @text('discount') discount!: string;
  @text('note') note!: string;
  @text('truck_id') truckId!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
