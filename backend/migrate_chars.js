
import mongoose from 'mongoose';
async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/manufacturing-inspection', { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;
  const chars = await db.collection('characteristics').find({}).toArray();
  const drawings = await db.collection('drawings').find({}).toArray();
  console.log('Total chars:', chars.length);
  let updated = 0;
  for (const c of chars) {
    if (!c.drawingId) {
      const projectDrawings = drawings.filter(d => String(d.projectId) === String(c.projectId));
      if (projectDrawings.length > 0) {
        const firstDrawingId = projectDrawings[0]._id;
        await db.collection('characteristics').updateOne({ _id: c._id }, { $set: { drawingId: String(firstDrawingId) } });
        updated++;
      }
    }
  }
  console.log('Migration complete. Updated chars:', updated);
  process.exit(0);
}
migrate().catch(console.error);

