-- ==============================================================================
-- SwasthaSathi - Supabase PostgreSQL Database Schema & Security Architecture
-- Production Hackathon Setup with Row Level Security (RLS)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (User-specific profiles linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    preferred_language TEXT DEFAULT 'en',
    preferred_location TEXT DEFAULT 'Pune, Maharashtra',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 3. Doctors Table (Verified healthcare providers & clinics directory)
CREATE TABLE IF NOT EXISTS public.doctors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    hospital TEXT NOT NULL,
    location TEXT NOT NULL,
    experience TEXT,
    consultation_fee TEXT DEFAULT 'Free (Govt / Empaneled)',
    rating NUMERIC(3, 2) DEFAULT 4.80,
    availability TEXT DEFAULT 'Daily OPD',
    description TEXT,
    phone TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    emergency_available BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 4. Recommendations Table (Saved AI triage & doctor recommendations)
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    input_summary TEXT NOT NULL,
    recommended_doctor_id TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
    recommendation_reason TEXT,
    risk_level TEXT DEFAULT 'VISIT_PHC',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 5. Doctor Preferences Table (User's preferred specialty, locality, and budget)
CREATE TABLE IF NOT EXISTS public.doctor_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    specialty TEXT,
    location TEXT,
    budget TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ENFORCEMENT
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_preferences ENABLE ROW LEVEL SECURITY;

-- Doctors Table RLS: Publicly readable for all users and guests
DROP POLICY IF EXISTS "Public can view verified doctors" ON public.doctors;
CREATE POLICY "Public can view verified doctors"
    ON public.doctors
    FOR SELECT
    USING (true);

-- Profiles Table RLS: Users can only read and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Recommendations Table RLS: Users can only see and add their own recommendations
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.recommendations;
CREATE POLICY "Users can view own recommendations"
    ON public.recommendations
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recommendations" ON public.recommendations;
CREATE POLICY "Users can insert own recommendations"
    ON public.recommendations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recommendations" ON public.recommendations;
CREATE POLICY "Users can delete own recommendations"
    ON public.recommendations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Doctor Preferences Table RLS: Users can only manage their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON public.doctor_preferences;
CREATE POLICY "Users can view own preferences"
    ON public.doctor_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.doctor_preferences;
CREATE POLICY "Users can insert own preferences"
    ON public.doctor_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.doctor_preferences;
CREATE POLICY "Users can update own preferences"
    ON public.doctor_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE TRIGGER ON NEW AUTH SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, preferred_language, preferred_location)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
        COALESCE(NEW.raw_user_meta_data->>'preferred_location', 'Pune, Maharashtra')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- SEED DATA: VERIFIED CLINICAL DIRECTORY (Pune / Haveli / Shirur Sector)
-- ==============================================================================
INSERT INTO public.doctors (id, name, specialization, hospital, location, experience, consultation_fee, rating, availability, description, phone, lat, lng, emergency_available)
VALUES
(
    'DOC_ADAMS',
    'Dr. Sarah Adams',
    'Cardiology & Internal Medicine',
    'Haveli Community Health Centre (CHC)',
    'Haveli, Pune',
    '12 years',
    '₹0 (Govt Hospital)',
    4.90,
    'Tomorrow 10:30 AM (In-Person OPD)',
    'Clinical Lead for cardiovascular health, hypertension screening, and acute coronary triage in rural Haveli.',
    '020-27051234',
    18.5802,
    73.9855,
    TRUE
),
(
    'DOC_LEE',
    'Dr. Mark Lee',
    'Pediatrics & Child Health',
    'Wagholi Pediatric Clinic & PHC',
    'Wagholi, Pune',
    '8 years',
    '₹0 (Govt PHC)',
    4.85,
    'Today 2:00 PM (Video / In-Person OPD)',
    'Specialist in neonatal care, pediatric infections, high-grade febrile episodes, and IMNCI triage.',
    '020-27051122',
    18.5793,
    73.9806,
    FALSE
),
(
    'DOC_SHINDE',
    'Dr. R. K. Shinde (MBBS)',
    'General Physician & Family Medicine',
    'Wagholi Arogya Clinic & Dispensary',
    'Opposite Gram Panchayat, Wagholi, Pune 412207',
    '15 years',
    '₹200 (Empaneled Low-Cost)',
    4.80,
    '8:30 AM - 1:30 PM, 4:30 PM - 8:30 PM',
    'Experienced general practitioner focusing on fever management, acute respiratory infections, and preventative health.',
    '020-27051122',
    18.5793,
    73.9806,
    FALSE
),
(
    'DOC_KULKARNI',
    'Dr. Sunita Kulkarni (Medical Officer)',
    'Maternal Health & Primary Healthcare',
    'Wagholi Primary Health Centre (PHC)',
    'Nagar Road, Wagholi, Pune 412207',
    '10 years',
    'Free (Govt PHC)',
    4.75,
    '8:00 AM - 4:00 PM (Daily)',
    'Primary medical officer coordinating 24x7 delivery care, immunization programs, and community referral handoffs.',
    '020-27051234',
    18.5802,
    73.9855,
    TRUE
),
(
    'DOC_JOSHI',
    'Dr. Anita Joshi (BAMS / CCEBDM)',
    'Family Medicine & Diabetology',
    'Sutarkar Community Health Clinic',
    'Near Bakori Phata, Wagholi, Pune 412207',
    '9 years',
    '₹150 (Community Clinic)',
    4.70,
    '9:00 AM - 7:00 PM (Mon-Sat)',
    'Community health doctor specializing in non-communicable disease control, diabetes baseline monitoring, and family triage.',
    '020-27054455',
    18.5880,
    73.9910,
    FALSE
),
(
    'DOC_DESHMUKH',
    'Dr. S. B. Deshmukh',
    'General Medicine & Tuberculosis Triage',
    'Lonikand Primary Health Centre (PHC)',
    'Grampanchayat Road, Lonikand, Pune 412216',
    '11 years',
    'Free (Govt PHC)',
    4.65,
    '9:00 AM - 4:00 PM (Mon-Sat)',
    'In-charge Medical Officer managing rural outreach, seasonal epidemic tracking, and diagnostic referrals.',
    '020-27055678',
    18.6112,
    74.0150,
    FALSE
),
(
    'DOC_GAIKWAD',
    'Dr. V. N. Gaikwad (Surgeon) & Dr. P. More',
    'Trauma & Pediatric Emergency Care',
    'Shikrapur Rural Hospital & CHC',
    'Taluka Shirur, Shikrapur 412208',
    '18 years',
    'Free (Govt CHC)',
    4.90,
    '24x7 Emergency Casualty',
    'Specialized surgery and pediatric emergency unit with 30-bed inpatient capacity, operation theatre, and oxygen beds.',
    '02137-286200',
    18.7015,
    74.1284,
    TRUE
),
(
    'DOC_HOSP_HADAPSAR',
    'Multi-Specialty Clinical Faculty',
    'Emergency & Critical Care',
    'Hadapsar Sub-District General Hospital',
    'Saswad Road, Hadapsar, Pune 411028',
    '20+ years collective',
    'Government Sub-District Hospital',
    4.85,
    '24x7 Casualty & ICU',
    '50-bed inpatient hospital providing round-the-clock emergency, digital radiology, pathology, and ICU support.',
    '020-26991100',
    18.4984,
    73.9312,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    specialization = EXCLUDED.specialization,
    hospital = EXCLUDED.hospital,
    location = EXCLUDED.location,
    experience = EXCLUDED.experience,
    consultation_fee = EXCLUDED.consultation_fee,
    rating = EXCLUDED.rating,
    availability = EXCLUDED.availability,
    description = EXCLUDED.description,
    phone = EXCLUDED.phone,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    emergency_available = EXCLUDED.emergency_available;
