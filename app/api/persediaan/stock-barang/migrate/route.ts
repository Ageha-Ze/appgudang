// app/api/persediaan/stock-barang/migrate/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import {
  fixOrphanedStockReferences,
  migrateProductionIdsFromKeterangan
} from '@/lib/helpers/stockSafety';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action parameter required: "fix_orphaned" or "migrate_produksi"' },
        { status: 400 }
      );
    }


    let result;

    if (action === 'fix_orphaned') {
      // Fix orphaned foreign keys
      result = await fixOrphanedStockReferences();

      return NextResponse.json({
        success: true,
        action: 'fix_orphaned',
        message: `Fixed ${result.fixed} orphaned stock references out of ${result.processed} processed records`,
        data: result
      });

    } else if (action === 'migrate_produksi') {
      // Safe migration of produksi_id from keterangan
      result = await migrateProductionIdsFromKeterangan();

      return NextResponse.json({
        success: true,
        action: 'migrate_produksi',
        message: `Successfully migrated ${result.migrated} produksi_id foreign keys out of ${result.processed} processed records`,
        data: result
      });

    } else {
      return NextResponse.json(
        { error: 'Unknown action. Use: "fix_orphaned" or "migrate_produksi"' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed'
    }, { status: 500 });
  }
}
