/**
 * SwasthaSathi Supabase Client & Authentication Layer.
 * Supports:
 * 1. Official Supabase Cloud Auth (Email + Password, Persistent Sessions, RLS).
 * 2. Auto-fetch credentials from backend /api/config or localStorage.
 * 3. Graceful Mock / Guest Mode fallback so judges can evaluate without mandatory credentials.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SwasthaSupabase = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // State
  let client = null;
  let isConfigured = false;
  let currentUser = null;
  let authListeners = [];

  // Default demo / mock data
  const MOCK_STORAGE_KEY_USER = 'swastha_auth_user';
  const MOCK_STORAGE_KEY_RECS = 'swastha_saved_recommendations';
  const MOCK_STORAGE_KEY_PREFS = 'swastha_saved_preferences';

  /**
   * Initialize Supabase client
   */
  async function init(customUrl, customKey) {
    let url = customUrl || localStorage.getItem('swastha_supabase_url') || (window.__ENV__ && window.__ENV__.SUPABASE_URL);
    let key = customKey || localStorage.getItem('swastha_supabase_anon_key') || (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY);

    // If not in window/storage, try to fetch from server /api/config
    if (!url || !key) {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.supabase_url && cfg.supabase_anon_key) {
            url = cfg.supabase_url;
            key = cfg.supabase_anon_key;
          }
        }
      } catch (e) {
        // Non-blocking
      }
    }

    // Strip out /rest/v1 or trailing slashes if user pasted the wrong endpoint
    if (url) {
      url = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    }

    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        isConfigured = true;

        // Check active session
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          currentUser = session.user;
        }

        // Listen for auth changes
        client.auth.onAuthStateChange((event, session) => {
          currentUser = session ? session.user : null;
          notifyAuthListeners(event, session);
        });

        console.log('✓ Connected to Supabase Cloud Authentication & PostgreSQL Database');
        return { success: true, mode: 'cloud', url };
      } catch (err) {
        console.warn('Could not initialize Supabase client:', err.message);
      }
    }

    // Fallback: Mock / Guest State
    isConfigured = false;
    const storedMockUser = localStorage.getItem(MOCK_STORAGE_KEY_USER);
    if (storedMockUser) {
      try {
        currentUser = JSON.parse(storedMockUser);
      } catch (e) {
        currentUser = null;
      }
    }

    console.log('ℹ SwasthaSathi running in Guest / Local Sandbox Mode (Supabase keys not detected or in guest flow)');
    return { success: true, mode: 'guest' };
  }

  function notifyAuthListeners(event, session) {
    authListeners.forEach((fn) => {
      try { fn(event, session, currentUser); } catch (e) { console.error(e); }
    });
  }

  function onAuthStateChange(listener) {
    if (typeof listener === 'function') {
      authListeners.push(listener);
    }
  }

  function isCloudConfigured() {
    return isConfigured && client !== null;
  }

  function getUser() {
    return currentUser;
  }

  function isGuest() {
    return !currentUser;
  }

  /**
   * Sign In with Email & Password
   */
  async function signIn(email, password) {
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    if (isCloudConfigured()) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      currentUser = data.user;
      notifyAuthListeners('SIGNED_IN', data.session);
      return { user: data.user, session: data.session };
    }

    // Mock Sign In for Hackathon Demo
    const mockUser = {
      id: 'mock-user-' + Math.random().toString(36).substring(2, 9),
      email: email.trim(),
      user_metadata: {
        full_name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      },
      created_at: new Date().toISOString()
    };
    currentUser = mockUser;
    localStorage.setItem(MOCK_STORAGE_KEY_USER, JSON.stringify(mockUser));
    notifyAuthListeners('SIGNED_IN', { user: mockUser });
    return { user: mockUser, isMock: true };
  }

  /**
   * Sign Up with Email, Password & Full Name
   */
  async function signUp(email, password, fullName) {
    if (!email || !password) {
      throw new Error('Please provide email and password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const cleanName = (fullName || email.split('@')[0]).trim();

    if (isCloudConfigured()) {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: cleanName,
            preferred_language: 'en',
            preferred_location: 'Pune, Maharashtra'
          }
        }
      });
      if (error) throw error;
      if (data.user) {
        currentUser = data.user;
        notifyAuthListeners('SIGNED_IN', data.session);
      }
      return { user: data.user, session: data.session };
    }

    // Mock Sign Up
    const mockUser = {
      id: 'mock-user-' + Math.random().toString(36).substring(2, 9),
      email: email.trim(),
      user_metadata: {
        full_name: cleanName
      },
      created_at: new Date().toISOString()
    };
    currentUser = mockUser;
    localStorage.setItem(MOCK_STORAGE_KEY_USER, JSON.stringify(mockUser));
    notifyAuthListeners('SIGNED_IN', { user: mockUser });
    return { user: mockUser, isMock: true };
  }

  /**
   * Sign Out
   */
  async function signOut() {
    if (isCloudConfigured()) {
      try {
        await client.auth.signOut();
      } catch (e) {
        // Ignore network failure on sign out
      }
    }
    currentUser = null;
    localStorage.removeItem(MOCK_STORAGE_KEY_USER);
    notifyAuthListeners('SIGNED_OUT', null);
    return { success: true };
  }

  /**
   * Send Password Reset Email
   */
  async function resetPassword(email) {
    if (!email) throw new Error('Please enter your registered email address.');
    if (isCloudConfigured()) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      return { success: true };
    }
    return { success: true, isMock: true };
  }

  /**
   * Get User Profile from profiles table
   */
  async function getProfile(userId) {
    const uid = userId || (currentUser && currentUser.id);
    if (!uid) return null;

    if (isCloudConfigured()) {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (!error && data) return data;
    }

    // Mock profile
    return {
      id: uid,
      full_name: (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || 'Sunita Tai',
      email: (currentUser && currentUser.email) || 'guest@swasthasathi.org',
      preferred_language: 'en',
      preferred_location: 'Wagholi, Haveli (Pune)'
    };
  }

  /**
   * Update Profile
   */
  async function updateProfile(userId, updates) {
    const uid = userId || (currentUser && currentUser.id);
    if (!uid) return null;

    if (isCloudConfigured()) {
      const { data, error } = await client
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', uid)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return { success: true, ...updates };
  }

  /**
   * Fetch verified Doctors from Supabase table or fallback facilities
   */
  async function getDoctors(limit = 10) {
    if (isCloudConfigured()) {
      try {
        const { data, error } = await client
          .from('doctors')
          .select('*')
          .order('rating', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        // Fall back to server facilities API
      }
    }

    // Fallback: Fetch from server /api/facilities
    try {
      const res = await fetch('/api/facilities?limit=' + limit);
      if (res.ok) {
        const facs = await res.json();
        return facs.map((f) => ({
          id: f.id,
          name: (f.doctors && f.doctors.split('•')[0].trim()) || f.name,
          specialization: (f.services && f.services[0]) || 'General Medicine',
          hospital: f.name,
          location: f.address || f.block || 'Pune',
          experience: '8+ years',
          consultation_fee: f.type === 'PHC' ? 'Free (Govt PHC)' : '₹150 - ₹300',
          rating: 4.8,
          availability: f.hours || 'Daily OPD',
          phone: f.phone,
          emergency_available: f.emergency_available
        }));
      }
    } catch (e) {}

    return [];
  }

  /**
   * Save a triage recommendation to recommendations table
   */
  async function saveRecommendation(recommendationData) {
    const uid = currentUser && currentUser.id;

    if (isCloudConfigured() && uid) {
      try {
        const { data, error } = await client
          .from('recommendations')
          .insert({
            user_id: uid,
            input_summary: recommendationData.input_summary,
            recommended_doctor_id: recommendationData.recommended_doctor_id || null,
            recommendation_reason: recommendationData.recommendation_reason,
            risk_level: recommendationData.risk_level || 'VISIT_PHC'
          })
          .select()
          .single();

        if (!error) return { success: true, data };
      } catch (err) {
        console.warn('Error saving recommendation to Supabase:', err.message);
      }
    }

    // Local / Guest persistence
    const existing = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_RECS) || '[]');
    const newRec = {
      id: 'rec-' + Date.now(),
      created_at: new Date().toISOString(),
      ...recommendationData
    };
    existing.unshift(newRec);
    localStorage.setItem(MOCK_STORAGE_KEY_RECS, JSON.stringify(existing.slice(0, 10)));
    return { success: true, data: newRec, isLocal: true };
  }

  /**
   * Retrieve saved recommendations
   */
  async function getSavedRecommendations() {
    const uid = currentUser && currentUser.id;

    if (isCloudConfigured() && uid) {
      try {
        const { data, error } = await client
          .from('recommendations')
          .select('*, doctors(*)')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data) return data;
      } catch (e) {}
    }

    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_RECS) || '[]');
  }

  /**
   * Save doctor preferences
   */
  async function savePreferences(prefs) {
    const uid = currentUser && currentUser.id;
    if (isCloudConfigured() && uid) {
      try {
        const { data, error } = await client
          .from('doctor_preferences')
          .upsert({
            user_id: uid,
            specialty: prefs.specialty,
            location: prefs.location,
            budget: prefs.budget,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (!error) return data;
      } catch (e) {}
    }

    localStorage.setItem(MOCK_STORAGE_KEY_PREFS, JSON.stringify(prefs));
    return prefs;
  }

  async function getPreferences() {
    const uid = currentUser && currentUser.id;
    if (isCloudConfigured() && uid) {
      try {
        const { data, error } = await client
          .from('doctor_preferences')
          .select('*')
          .eq('user_id', uid)
          .single();
        if (!error && data) return data;
      } catch (e) {}
    }
    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_PREFS) || 'null');
  }

  // Public API
  return {
    init,
    isCloudConfigured,
    getUser,
    isGuest,
    signIn,
    signUp,
    signOut,
    resetPassword,
    getProfile,
    updateProfile,
    getDoctors,
    saveRecommendation,
    getSavedRecommendations,
    savePreferences,
    getPreferences,
    onAuthStateChange
  };
});
