'use client';

import { useState, useRef } from 'react';
import { updateChildAccount } from '@/firebase/firestore';
import { uploadChildProfileImage, deleteChildProfileImage } from '@/firebase/storage';
import Button from '@/components/common/Button';
import ErrorMessage from '@/components/common/ErrorMessage';
import SuccessMessage from '@/components/common/SuccessMessage';

/**
 * Child Profile Manager Component - for editing child profiles with image upload
 * 
 * @param {Object} props
 * @param {Object} props.child - Child data
 * @param {Function} props.onUpdate - Callback when child is updated
 * @param {Function} props.onCancel - Callback when editing is cancelled
 */
export default function ChildProfileManager({ child, onUpdate, onCancel }) {
  const [formData, setFormData] = useState({
    name: child.name || '',
    age: child.age || '',
    interests: child.interests || '',
    photoURL: child.photoURL || '',
  });
  
  const [imageUpload, setImageUpload] = useState({
    file: null,
    preview: null,
    uploading: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef(null);
  
  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear messages when user types
    setError(null);
    setSuccess(false);
  };
  
  /**
   * Handle image file selection
   */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setImageUpload({
        file,
        preview: reader.result,
        uploading: false,
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };
  
  /**
   * Handle image upload
   */
  const handleImageUpload = async () => {
    if (!imageUpload.file) return;
    
    try {
      setImageUpload(prev => ({ ...prev, uploading: true }));
      setError(null);
      
      // Upload image to Firebase Storage
      const photoURL = await uploadChildProfileImage(child.id, imageUpload.file);
      
      // Update form data with new photo URL
      setFormData(prev => ({
        ...prev,
        photoURL
      }));
      
      // Clear upload state
      setImageUpload({
        file: null,
        preview: null,
        uploading: false,
      });
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSuccess(true);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setImageUpload(prev => ({ ...prev, uploading: false }));
    }
  };
  
  /**
   * Handle image removal
   */
  const handleImageRemove = async () => {
    try {
      setImageUpload(prev => ({ ...prev, uploading: true }));
      
      // Delete image from Firebase Storage if exists
      if (formData.photoURL) {
        await deleteChildProfileImage(child.id);
      }
      
      // Update form data to remove photo URL
      setFormData(prev => ({
        ...prev,
        photoURL: ''
      }));
      
      // Clear upload state
      setImageUpload({
        file: null,
        preview: null,
        uploading: false,
      });
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSuccess(true);
    } catch (err) {
      console.error('Error removing image:', err);
      setError('Failed to remove image. Please try again.');
    } finally {
      setImageUpload(prev => ({ ...prev, uploading: false }));
    }
  };
  
  /**
   * Cancel image upload
   */
  const cancelImageUpload = () => {
    setImageUpload({
      file: null,
      preview: null,
      uploading: false,
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setError(null);
  };
  
  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      // Validate required fields
      if (!formData.name.trim()) {
        setError('Child name is required.');
        setLoading(false);
        return;
      }
      
      // Update child profile in Firestore
      await updateChildAccount(child.id, {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        interests: formData.interests.trim(),
        photoURL: formData.photoURL,
      });
      
      setSuccess(true);
      
      // Call onUpdate callback with updated data
      if (onUpdate) {
        onUpdate({
          ...child,
          name: formData.name.trim(),
          age: formData.age ? parseInt(formData.age) : null,
          interests: formData.interests.trim(),
          photoURL: formData.photoURL,
        });
      }
    } catch (err) {
      console.error('Error updating child profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Edit Child Profile</h2>
      
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message="Profile updated successfully!" />}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {formData.photoURL || imageUpload.preview ? (
              <img
                src={imageUpload.preview || formData.photoURL}
                alt={`${formData.name}'s profile`}
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100"
              />
            ) : (
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center border-4 border-indigo-100">
                <span className="text-indigo-700 text-3xl font-semibold">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            )}
            
            {/* Image upload button */}
            <div className="absolute -bottom-2 -right-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
                disabled={imageUpload.uploading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          
          {/* Image upload actions */}
          {imageUpload.file && (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleImageUpload}
                disabled={imageUpload.uploading}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {imageUpload.uploading ? 'Uploading...' : 'Save Photo'}
              </button>
              <button
                type="button"
                onClick={cancelImageUpload}
                disabled={imageUpload.uploading}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
          
          {/* Remove image button */}
          {formData.photoURL && !imageUpload.file && (
            <button
              type="button"
              onClick={handleImageRemove}
              disabled={imageUpload.uploading}
              className="text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
            >
              Remove Photo
            </button>
          )}
        </div>
        
        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
              Age
            </label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              min="1"
              max="18"
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="interests" className="block text-sm font-medium text-gray-700 mb-1">
            Interests & Hobbies
          </label>
          <textarea
            id="interests"
            name="interests"
            value={formData.interests}
            onChange={handleInputChange}
            rows={3}
            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="What does your child like? (e.g., dinosaurs, princesses, sports...)"
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading || imageUpload.uploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || imageUpload.uploading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}