
import mongoose from 'mongoose';
async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/manufacturing-inspection', { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;
  const balloons = await db.collection('balloons').find({}).toArray();
  const drawings = await db.collection('drawings').find({}).toArray();
  console.log('Total balloons:', balloons.length);
  let updated = 0;
  for (const b of balloons) {
    if (!b.drawingId) {
      const projectDrawings = drawings.filter(d => String(d.projectId) === String(b.projectId));
      if (projectDrawings.length > 0) {
        const firstDrawingId = projectDrawings[0]._id;
        await db.collection('balloons').updateOne({ _id: b._id }, { $set: { drawingId: String(firstDrawingId) } });
        updated++;
      }
    }
  }
  console.log('Migration complete. Updated balloons:', updated);
  process.exit(0);
}
migrate().catch(console.error);

