
import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Student, Driver } from '../types';
import ProfilePicture from '../components/ProfilePicture';
import { useNotification } from '../contexts/NotificationContext';

const ProfileScreen: React.FC = () => {
    const { authUser, student, driver, setView, updateUserProfile } = useFirebase();
    const { showNotification } = useNotification();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // State for image upload
    const [newProfilePicFile, setNewProfilePicFile] = useState<File | null>(null);
    const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);

    // FIX: The intersection `Student & Driver` creates a `role: never` property, causing type errors.
    // Redefined `ProfileData` to specify only the editable fields, resolving the issue.
    type ProfileData = {
        name?: string;
        age?: string;
        gender?: string;
        mobileNumber?: string;
        photoURL?: string;
        emergencyContact?: {
            name: string;
            phone: string;
        };
    };
    const [formData, setFormData] = useState<ProfileData>({});

    const userProfile = authUser?.role === 'student' ? student : driver;
    const userInitial = userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : '?';

    useEffect(() => {
        if (userProfile) {
            const initialData: ProfileData = {
                name: userProfile.name || '',
                age: userProfile.age || '',
                gender: userProfile.gender || '',
                mobileNumber: userProfile.mobileNumber || '',
                photoURL: userProfile.photoURL || '',
            };
            if(student) {
                initialData.emergencyContact = student.emergencyContact || { name: '', phone: '' };
            }
            setFormData(initialData);
        }
    }, [userProfile, student]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "emergencyContactName" || name === "emergencyContactPhone") {
            const field = name === "emergencyContactName" ? "name" : "phone";
            setFormData(prev => ({
                ...prev,
                emergencyContact: {
                    ...(prev.emergencyContact || { name: '', phone: '' }),
                    [field]: value,
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileSelect = (file: File) => {
        setNewProfilePicFile(file);
        setProfilePicPreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (!authUser) return;
        setLoading(true);
        try {
            await updateUserProfile(formData, newProfilePicFile);
            
            // On success, reset state and exit edit mode
            setNewProfilePicFile(null);
            setProfilePicPreview(null);
            setIsEditing(false);
        } catch (error) {
            // The error is already logged and notified by the context.
            // We just need to handle UI state here.
            console.error("Caught error in ProfileScreen:", error);
        } finally {
            // This will run whether the try block succeeds or fails.
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (userProfile) {
            // FIX: Reset all form fields, including photoURL, to match initial state setup.
            const initialData: ProfileData = {
                name: userProfile.name || '',
                age: userProfile.age || '',
                gender: userProfile.gender || '',
                mobileNumber: userProfile.mobileNumber || '',
                photoURL: userProfile.photoURL || '',
            };
            if(student) {
                initialData.emergencyContact = student.emergencyContact || { name: '', phone: '' };
            }
            setFormData(initialData);
        }
        setNewProfilePicFile(null);
        setProfilePicPreview(null);
        setIsEditing(false);
    };

    if (!userProfile) {
        return <div className="text-center p-5">Loading profile...</div>;
    }

    const renderDetailItem = (icon: string, label: string, value: string | number | undefined) => (
        <div className="d-flex align-items-center mb-3">
            <i className={`fas ${icon} fa-fw me-3 text-muted`} style={{width: '20px'}}></i>
            <div>
                <div className="small text-muted">{label}</div>
                <div className="fw-bold">{value || 'Not set'}</div>
            </div>
        </div>
    );

    return (
        <div>
            <button onClick={() => setView('dashboard')} className="btn-action mb-4">
                <i className="fas fa-arrow-left me-2"></i>Back to Dashboard
            </button>
            <div className="app-card profile-card">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3 className="booking-title mb-0">Profile & Settings</h3>
                    {!isEditing && (
                        <button onClick={() => setIsEditing(true)} className="btn-action">
                            <i className="fas fa-pencil-alt me-2"></i>Edit Profile
                        </button>
                    )}
                </div>

                <ProfilePicture
                    src={userProfile.photoURL}
                    preview={profilePicPreview}
                    initial={userInitial}
                    isEditable={isEditing}
                    onFileSelect={handleFileSelect}
                />

                {/* Non-Editable Info */}
                <div className="row mb-3">
                    <div className="col-md-6">
                        {renderDetailItem('fa-envelope', 'Email', authUser?.email)}
                    </div>
                    <div className="col-md-6">
                        {renderDetailItem('fa-user-tag', 'Role', userProfile.role)}
                    </div>
                </div>
                 {student && (
                    <div className="row mb-4">
                        <div className="col-md-6">
                            {renderDetailItem('fa-wallet', 'Wallet Balance', `₹${student.walletBalance.toFixed(2)}`)}
                        </div>
                    </div>
                )}
                {driver && driver.vehicleDetails && (
                     <div className="mb-4">
                        <h5 className="section-title mb-3" style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem'}}>Vehicle Information</h5>
                        <div className="row">
                            <div className="col-md-4">{renderDetailItem('fa-car', 'Make', driver.vehicleDetails.make)}</div>
                            <div className="col-md-4">{renderDetailItem('fa-car-side', 'Model', driver.vehicleDetails.model)}</div>
                            <div className="col-md-4">{renderDetailItem('fa-id-card', 'License Plate', driver.vehicleDetails.licensePlate)}</div>
                        </div>
                    </div>
                )}
                
                {/* Editable Info */}
                <h5 className="section-title mb-3" style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem'}}>Personal Details</h5>
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label">Full Name</label>
                        <input type="text" name="name" className="form-control" value={formData.name || ''} onChange={handleInputChange} disabled={!isEditing} />
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label">Mobile Number</label>
                        <input type="tel" name="mobileNumber" className="form-control" value={formData.mobileNumber || ''} onChange={handleInputChange} disabled={!isEditing} placeholder="e.g., 9876543210" />
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label">Age</label>
                        <input type="number" name="age" className="form-control" value={formData.age || ''} onChange={handleInputChange} disabled={!isEditing} placeholder="e.g., 21" />
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label">Gender</label>
                        <select name="gender" className="form-control" value={formData.gender || ''} onChange={handleInputChange} disabled={!isEditing}>
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                    </div>
                </div>

                {student && (
                    <>
                        <h5 className="section-title my-3" style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem'}}>Emergency Contact</h5>
                        <p className="small text-muted" style={{marginTop: '-0.75rem', marginBottom: '1rem'}}>
                            This contact will be alerted if you use the SOS feature during a ride.
                        </p>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Contact Name</label>
                                <input type="text" name="emergencyContactName" className="form-control" value={formData.emergencyContact?.name || ''} onChange={handleInputChange} disabled={!isEditing} placeholder="e.g., Jane Doe" />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Contact Phone</label>
                                <input type="tel" name="emergencyContactPhone" className="form-control" value={formData.emergencyContact?.phone || ''} onChange={handleInputChange} disabled={!isEditing} placeholder="e.g., 9876543210" />
                            </div>
                        </div>
                    </>
                )}


                {isEditing && (
                    <div className="d-flex justify-content-end mt-4">
                        <button onClick={handleCancel} className="btn-action me-2">Cancel</button>
                        <button onClick={handleSave} className="btn-book" disabled={loading} style={{width: 'auto', padding: '0.8rem 1.5rem'}}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileScreen;