const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('SwasthaSathi Web Structure & Quality Assurance Verification', (t) => {
  const indexHtml = path.join(__dirname, 'web', 'index.html');
  const stylesCss = path.join(__dirname, 'web', 'styles.css');
  const appJs = path.join(__dirname, 'web', 'app.js');
  const supabaseClientJs = path.join(__dirname, 'web', 'supabaseClient.js');
  const guidelinesJson = path.join(__dirname, 'data', 'clinical_guidelines.json');
  const schemaSql = path.join(__dirname, 'supabase_schema.sql');

  assert.ok(fs.existsSync(indexHtml), 'web/index.html must exist');
  assert.ok(fs.existsSync(stylesCss), 'web/styles.css must exist');
  assert.ok(fs.existsSync(appJs), 'web/app.js must exist');
  assert.ok(fs.existsSync(supabaseClientJs), 'web/supabaseClient.js must exist');
  assert.ok(fs.existsSync(guidelinesJson), 'data/clinical_guidelines.json must exist');
  assert.ok(fs.existsSync(schemaSql), 'supabase_schema.sql must exist');

  const htmlContent = fs.readFileSync(indexHtml, 'utf-8');
  const appJsContent = fs.readFileSync(appJs, 'utf-8');
  const supabaseJsContent = fs.readFileSync(supabaseClientJs, 'utf-8');
  const schemaContent = fs.readFileSync(schemaSql, 'utf-8');
  const guidelines = JSON.parse(fs.readFileSync(guidelinesJson, 'utf-8'));

  // 1. Core Brand & Views
  assert.ok(htmlContent.includes('SwasthaSathi'), 'index.html must include SwasthaSathi title/brand');
  assert.ok(htmlContent.includes('view-home'), 'index.html must include home view');
  assert.ok(htmlContent.includes('view-triage'), 'index.html must include triage view');
  assert.ok(htmlContent.includes('view-facilities'), 'index.html must include facilities view');
  assert.ok(htmlContent.includes('view-records'), 'index.html must include lab records view');
  assert.ok(htmlContent.includes('view-profile'), 'index.html must include patient profile view');
  assert.ok(htmlContent.includes('view-doctor-dashboard'), 'index.html must include doctor dashboard view');
  assert.ok(htmlContent.includes('view-doctor-pending'), 'index.html must include doctor pending verification view');

  // 2. Modals & Functionality
  assert.ok(htmlContent.includes('appointmentModal'), 'index.html must include appointment booking modal');
  assert.ok(htmlContent.includes('guidelinesModal'), 'index.html must include clinical guidelines modal');
  assert.ok(htmlContent.includes('authModal'), 'index.html must include auth modal');
  assert.ok(htmlContent.includes('vitalsModal'), 'index.html must include patient vitals modal');
  assert.ok(htmlContent.includes('voiceModal'), 'index.html must include voice recording modal');

  // 3. Purge of Fake Ratings & Simulated Match Scores
  assert.ok(!htmlContent.includes('98% Match'), 'index.html must NOT contain simulated 98% match percentage');
  assert.ok(!htmlContent.includes('Dr. Sarah Adams'), 'index.html must NOT contain fictional generic doctor names');
  assert.ok(!htmlContent.includes('Dr. Mark Lee'), 'index.html must NOT contain fictional generic doctor names');

  // 4. Role-based Access Control in Database Schema
  assert.ok(schemaContent.includes("CHECK (role IN ('patient', 'doctor', 'admin'))"), 'Schema must enforce role constraint');
  assert.ok(schemaContent.includes('CREATE TABLE IF NOT EXISTS public.doctor_verifications'), 'Schema must have doctor_verifications table');
  assert.ok(schemaContent.includes('CREATE TABLE IF NOT EXISTS public.appointments'), 'Schema must have appointments table');
  assert.ok(schemaContent.includes('CREATE TABLE IF NOT EXISTS public.symptom_assessments'), 'Schema must have symptom_assessments table');
  assert.ok(schemaContent.includes('ENABLE ROW LEVEL SECURITY'), 'Schema must enable Row Level Security');
  assert.ok(schemaContent.includes('protect_profile_role'), 'Schema must include trigger to prevent unauthorized role escalation');

  // 5. Supabase Client Functionality
  assert.ok(supabaseJsContent.includes('createAppointment'), 'supabaseClient.js must implement createAppointment');
  assert.ok(supabaseJsContent.includes('getAppointments'), 'supabaseClient.js must implement getAppointments');
  assert.ok(supabaseJsContent.includes('getDoctorVerification'), 'supabaseClient.js must implement getDoctorVerification');
  assert.ok(supabaseJsContent.includes('submitDoctorVerification'), 'supabaseClient.js must implement submitDoctorVerification');

  // 6. Clinical Guidelines & Medical Governance
  assert.ok(guidelines.sources && guidelines.sources.length >= 3, 'Must have at least 3 authenticated clinical guidelines');
  assert.ok(guidelines.disclaimer.includes('does not constitute a definitive medical diagnosis'), 'Must include transparent non-diagnosis disclaimer');
  const hasMoHFW = guidelines.sources.some(s => s.authority.includes('MoHFW'));
  assert.ok(hasMoHFW, 'Must cite Ministry of Health and Family Welfare (MoHFW) India');
});
