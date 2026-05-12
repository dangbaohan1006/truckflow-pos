import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class Transaction extends Model {
  static table = 'transactions';

  @text('type') type!: string;
  @text('category') category!: string;
  @text('amount') amount!: string;
  @text('note') note!: string;
  @text('reference_type') referenceType!: string;
  @text('reference_id') referenceId!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
