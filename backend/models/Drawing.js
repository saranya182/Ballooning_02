import mongoose from 'mongoose';

const drawingSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },

    fileName: {
      type: String,
      required: true
    },

    filePath: {
      type: String,
      required: true
    },

    pageCount: {
      type: Number,
      default: 1
    },

    uploadedAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

const Drawing =
  mongoose.models.Drawing ||
  mongoose.model('Drawing', drawingSchema);

export default Drawing;