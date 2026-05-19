import { database } from './index.js';
import User from './models/User.js';
import { generateId } from '../shared/utils.js';

/**
 * Initialize default admin user if no users exist
 * User credentials: admin / 123456
 */
export async function initializeDefaultUsers() {
  try {
    // Wait for database to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔍 Checking for existing users...');
    const users = await database.get<User>('users').query().fetch();
    
    // If users already exist, don't create default one
    if (users.length > 0) {
      console.log(`✓ Found ${users.length} existing user(s), skipping initialization`);
      return;
    }

    console.log('Creating default users...');

    // Create default users within a write transaction
    await database.write(async () => {
      const userDefs = [
        { username: 'admin', password: '123456', displayName: 'Administrator', role: 'SYSTEM_ADMIN' },
      ];

      for (const def of userDefs) {
        const newUser = await database.get<User>('users').create((user: any) => {
          user._raw.id = generateId();
          user.username = def.username;
          user.password = def.password;
          user.displayName = def.displayName;
          user.role = def.role;
          user.status = 'ACTIVE';
        });

        console.log(`✅ User created: ${def.username} / ${def.password} (${def.role})`);
      }
    });
  } catch (error) {
    console.error('❌ Error initializing default users:', error);
    // Don't throw - let the app continue even if initialization fails
  }
}
