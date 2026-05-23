import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'menu_items',
          columns: [
            { name: 'image', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
