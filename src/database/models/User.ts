import { Model } from '@nozbe/watermelondb';
import { field, text, readonly } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @text('username') username!: string;
  @text('password') password!: string;
  @text('display_name') displayName!: string;
  @text('role') role!: string;
  @text('status') status!: string; // ACTIVE, INACTIVE
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
