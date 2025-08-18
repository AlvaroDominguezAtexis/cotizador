import db from '../db';

export async function ensureDbConstraints() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1) Drop a known old constraint name if it exists (2-column unique)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'project_profile_salaries_project_profile_id_country_id_key'
        ) THEN
          ALTER TABLE project_profile_salaries
          DROP CONSTRAINT project_profile_salaries_project_profile_id_country_id_key;
        END IF;
      END$$;
    `);

    // 2) Detect any other unique constraints on exactly (project_profile_id, country_id) and drop them
    const findConstraints = `
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = 'u'
        AND n.nspname = current_schema()
        AND t.relname = 'project_profile_salaries'
        AND (
          SELECT string_agg(a.attname, ',' ORDER BY a.attname)
          FROM unnest(c.conkey) AS k
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        ) = 'country_id,project_profile_id';
    `;
    const { rows } = await client.query(findConstraints);
    for (const r of rows) {
      await client.query(`ALTER TABLE project_profile_salaries DROP CONSTRAINT ${r.conname};`);
    }

    // 3) Create the new 3-column unique constraint if missing
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE c.contype = 'u'
            AND t.relname = 'project_profile_salaries'
            AND c.conname = 'project_profile_salaries_pp_country_year_key'
        ) THEN
          ALTER TABLE project_profile_salaries
          ADD CONSTRAINT project_profile_salaries_pp_country_year_key
          UNIQUE (project_profile_id, country_id, year);
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ensureDbConstraints failed', e);
  } finally {
    client.release();
  }
}
