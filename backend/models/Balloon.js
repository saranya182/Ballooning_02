import mongoose from 'mongoose';

const balloonSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },

    drawingId: {
      type: String,
      required: true,
      index: true
    },

    page: {
      type: Number,
      default: 1
    },

    number: {
      type: Number,
      required: true
    },

    x: {
      type: Number,
      required: true
    },

    y: {
      type: Number,
      required: true
    },

    anchorX: {
      type: Number,
      default: 0
    },

    anchorY: {
      type: Number,
      default: 0
    },

    text: {
      type: String,
      default: ''
    },

    type: {
      type: String,
      default: 'Dimension'
    },

    status: {
      type: String,
      default: 'Draft'
    },

    createdBy: {
      type: String,
      default: ''
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
);

const Balloon =
  mongoose.models.Balloon ||
  mongoose.model('Balloon', balloonSchema);

export default Balloon;
