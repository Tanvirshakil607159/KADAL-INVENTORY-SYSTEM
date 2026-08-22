const { dbPrepare, getSupabase, isCloudEnabled } = require('./src/main/database/connection');

async function run() {
  console.log('Starting receiver name unification...');
  const targetName = 'K.A. DESIGN WEAR LTD.';
  
  // We can just fetch all unique receiver_names and update those that match our target pattern case-insensitively
  // Or just run direct queries for the variations.
  
  if (isCloudEnabled()) {
    console.log('Cloud is enabled. Updating Supabase...');
    const supabase = getSupabase();
    
    // Find all distinct receivers first to see what needs changing
    const { data: challans, error: fetchErr } = await supabase.from('challans').select('id, receiver_name').ilike('receiver_name', 'K.%A.%Design%Wear%Ltd%');
    
    if (fetchErr) {
      console.error('Error fetching from cloud:', fetchErr);
    } else {
      let updatedCount = 0;
      for (const challan of challans) {
        if (challan.receiver_name !== targetName) {
          await supabase.from('challans').update({ receiver_name: targetName }).eq('id', challan.id);
          updatedCount++;
        }
      }
      console.log(`Updated ${updatedCount} records in cloud database.`);
    }
  }

  console.log('Updating local SQLite database...');
  try {
    const records = dbPrepare("SELECT id, receiver_name FROM challans WHERE receiver_name LIKE 'K.%A.%Design%Wear%Ltd%'").all();
    let updatedCount = 0;
    for (const record of records) {
      if (record.receiver_name !== targetName) {
        dbPrepare("UPDATE challans SET receiver_name = ? WHERE id = ?").run(targetName, record.id);
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} records in local database.`);
  } catch (err) {
    console.error('Error updating local database:', err);
  }

  console.log('Done.');
  process.exit(0);
}

run();
