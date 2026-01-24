const mongoose = require('mongoose');
const Preview = require('../models/preview.model');

// Create a new preview
class PreviewController {
 async createPreview(req, res) {
  try {
   const previewData = req.body;
   const newPreview = new Preview(previewData);
   const savedPreview = await newPreview.save();
   res.status(201).json(savedPreview);
  } catch (error) {
   res.status(500).json({ message: 'Error creating preview', error });
  }
 }

 // Get a preview by ID
 async getPreviewById(req, res) {
  try {
   const { id } = req.params;
   const preview = await Preview.findById(id);
   if (!preview) {
    return res.status(404).json({ message: 'Preview not found' });
   }
   res.status(200).json(preview);
  } catch (error) {
   res.status(500).json({ message: 'Error retrieving preview', error });
  }
 }
 // Update a preview by ID
 async updatePreview(req, res) {
  try {
   const { id } = req.params;
   const updateData = req.body;
   const updatedPreview = await Preview.findByIdAndUpdate(id, updateData, { new: true });  // { new: true } returns the updated document
   if (!updatedPreview) {
    return res.status(404).json({ message: 'Preview not found' });
   }
   res.status(200).json(updatedPreview);
  } catch (error) {
   res.status(500).json({ message: 'Error updating preview', error });
  }
 }

 // Delete a preview by ID
 async deletePreview(req, res) {
  try {
   const { id } = req.params;
   const deletedPreview = await Preview.findByIdAndDelete(id);
   if (!deletedPreview) {
    return res.status(404).json({ message: 'Preview not found' });
   }
   res.status(200).json({ message: 'Preview deleted successfully' });
  } catch (error) {
   res.status(500).json({ message: 'Error deleting preview', error });
  }
 }
}

module.exports = new PreviewController();