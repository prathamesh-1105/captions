const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Inline .env loader
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    if (line.trim().startsWith('#') || !line.trim()) return;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function inspectSchema() {
  console.log('=== Database Schema Inspector ===\n');
  
  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/?apikey=${supabaseServiceRoleKey}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch schema documentation: ${res.statusText}`);
    }
    const schema = await res.json();
    
    console.log('Tables detected in your database:');
    const paths = Object.keys(schema.paths || {});
    console.log(paths);

    if (schema.definitions) {
      for (const tableName of Object.keys(schema.definitions)) {
        console.log(`\nColumns found in the "${tableName}" table:`);
        const properties = schema.definitions[tableName].properties || {};
        for (const colName of Object.keys(properties)) {
          const colInfo = properties[colName];
          console.log(`  - ${colName} (${colInfo.type || 'unknown'}${colInfo.format ? ', ' + colInfo.format : ''})`);
        }
      }
    } else {
      console.log('\n[ERROR] Could not find any table definitions.');
    }
  } catch (err) {
    console.error('Inspection failed:', err.message);
  }
}

inspectSchema();
