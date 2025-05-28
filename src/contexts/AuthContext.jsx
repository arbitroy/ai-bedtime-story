'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/firebase/firebaseConfig';
import { loginUser, logoutUser, registerUser } from '@/firebase/auth';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Create context
const AuthContext = createContext();

/**
 * Hook to use the auth context
 * 
 * @returns {Object} Auth context values
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

/**
 * Auth provider component
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Auth provider component
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    /**
     * Function to refresh user data from Firestore
     * Useful after profile updates (like photo upload)
     */
    const refreshUser = async () => {
        if (auth.currentUser) {
            try {
                console.log('🔄 Refreshing user data...');
                
                // Get fresh user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const updatedUserData = {
                        uid: auth.currentUser.uid,
                        email: auth.currentUser.email,
                        displayName: auth.currentUser.displayName,
                        ...userData
                    };
                    
                    // 🔍 DEBUG LOGS
                    console.log('🔍 REFRESH DEBUG:');
                    console.log('- Firebase Auth User:', auth.currentUser);
                    console.log('- Firestore Document Data:', userData);
                    console.log('- Combined User Data:', updatedUserData);
                    console.log('- User Role:', updatedUserData.role);
                    
                    setUser(updatedUserData);
                    console.log('✅ User data refreshed successfully');
                } else {
                    console.warn('❌ User document not found in Firestore during refresh');
                }
            } catch (error) {
                console.error('❌ Error refreshing user data:', error);
            }
        } else {
            console.warn('❌ No authenticated user to refresh');
        }
    };

    // Register a new user
    const register = async (email, password, displayName, role, familyId) => {
        try {
            console.log('📝 Registering user:', { email, displayName, role, familyId });
            const newUser = await registerUser(email, password, displayName, role, familyId);
            // User will be set by the onAuthStateChanged listener
            return newUser;
        } catch (error) {
            console.error('❌ Register error:', error);
            throw error;
        }
    };

    // Log in a user
    const login = async (email, password) => {
        try {
            console.log('🔐 Logging in user:', email);
            const user = await loginUser(email, password);

            // 🔍 DEBUG LOGS DETALHADOS
            console.log('🔍 LOGIN FUNCTION DEBUG:');
            console.log('- loginUser() returned:', user);
            console.log('- User role from login:', user?.role);
            console.log('- User email:', user?.email);
            console.log('- User UID:', user?.uid);

            // Save cookie to middleware
            document.cookie = `user=${JSON.stringify({
                role: user.role,
                email: user.email,
            })}; path=/`;
            
            console.log('🍪 Cookie saved with role:', user.role);
            
            // User will be set by the onAuthStateChanged listener
            return user;
        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    };

    // Log out the current user
    const logout = async () => {
        try {
            console.log('🚪 Logging out user');
            await logoutUser();

            //remove cookie
            document.cookie = 'user=;Max-Age=0; path=/';
            console.log('🍪 Cookie removed');
            
            // User will be cleared by the onAuthStateChanged listener
            router.push('/login');
        } catch (error) {
            console.error('❌ Logout error:', error);
            throw error;
        }
    };

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            try {
                console.log('🔍 AUTH STATE CHANGED:', authUser?.email || 'No user');
                
                if (authUser) {
                    // User is signed in, get additional user data from Firestore
                    console.log('📁 Getting user document from Firestore...');
                    const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                
                    if (userDoc.exists()) {
                        const firestoreData = userDoc.data();
                        
                        // Combine auth user and Firestore data
                        const combinedUserData = {
                            uid: authUser.uid,
                            email: authUser.email,
                            displayName: authUser.displayName,
                            ...firestoreData
                        };
                        
                        // 🔍 SUPER DETAILED DEBUG
                        console.log('🔍 AUTH STATE DEBUG:');
                        console.log('- Firebase Auth User UID:', authUser.uid);
                        console.log('- Firebase Auth Email:', authUser.email);
                        console.log('- Firestore Document Exists:', userDoc.exists());
                        console.log('- Raw Firestore Data:', firestoreData);
                        console.log('- Firestore Role Field:', firestoreData.role);
                        console.log('- Combined User Data:', combinedUserData);
                        console.log('- Final Role Value:', combinedUserData.role);
                        
                        setUser(combinedUserData);
                        console.log('✅ User authenticated and data loaded:', combinedUserData.displayName || combinedUserData.email);
                    } else {
                        // User exists in Auth but not in Firestore - edge case
                        console.warn('⚠️ User exists in Auth but not in Firestore - creating default document');
                        const defaultData = {
                            email: authUser.email,
                            displayName: authUser.displayName || '',
                            role: 'parent', // Default role
                            familyId: authUser.uid,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        };

                        await setDoc(doc(db, 'users', authUser.uid), defaultData, { merge: true });

                        const newUserData = {
                            uid: authUser.uid,
                            ...defaultData
                        };
                        
                        console.log('📝 Created default user document:', newUserData);
                        setUser(newUserData);
                    }
                } else {
                    // User is signed out
                    setUser(null);
                    console.log('🚪 User signed out');
                }
            } catch (error) {
                console.error('❌ Auth state change error:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    // Provide authentication context value
    const value = {
        user,
        loading,
        register,
        login,
        logout,
        refreshUser
    };

    // Show loading screen while initializing
    if (loading) {
        return <LoadingSpinner fullScreen message="Loading..." />;
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;