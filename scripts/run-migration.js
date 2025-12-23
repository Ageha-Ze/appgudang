const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Running database migration...');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'add_product_details_to_stock_barang.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 SQL to execute:');
    console.log(sql);
    console.log('\n' + '='.repeat(50) + '\n');

    // Split SQL into individual statements (basic approach)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // If rpc doesn't work, try direct query
          const { error: queryError } = await supabase.from('_supabase_migration_temp').select('*').limit(0);
          console.log('Note: Using alternative migration method...');

          // For schema changes, we need to use raw SQL
          console.log('⚠️  Please run this SQL manually in your Supabase SQL editor:');
          console.log('\n' + statement + '\n');
          continue;
        }

        console.log('✅ Statement executed successfully\n');
      }
    }

    console.log('🎉 Migration completed!');

    // Verify the columns were added
    console.log('🔍 Verifying new columns...');
    const { data, error } = await supabase
      .from('stock_barang')
      .select('nama_produk, kode_produk, satuan')
      .limit(1);

    if (error) {
      console.log('❌ Error verifying columns:', error.message);
    } else {
      console.log('✅ Columns verified successfully!');
      console.log('📊 Sample data structure:', data);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Manual execution instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of scripts/add_product_details_to_stock_barang.sql');
    console.log('4. Execute the SQL');
  }
}

// Run the migration
runMigration();
