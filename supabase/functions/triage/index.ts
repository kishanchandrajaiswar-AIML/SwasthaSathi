/**
 * Supabase Edge Function: Triage Assessment
 * Securely calls Groq LLM API with deterministic safety red-flag checks.
 */
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { checkDeterministicEmergency } from '../_shared/safetyRules.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { text, language = 'en', follow_ups = [], session_id = 'edge-session' } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: 'Symptom text is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedText = text.trim();

    // 1. Deterministic Emergency Short-Circuit (Zero LLM Latency, Guaranteed Safety)
    const emergencyMatch = checkDeterministicEmergency(trimmedText);
    if (emergencyMatch) {
      const emergencyPayload = {
        success: true,
        triage_result: {
          risk_level: 'EMERGENCY',
          risk_source: 'DETERMINISTIC_PRE_LLM',
          recommended_action: emergencyMatch.recommendedAction,
          plain_language_explanation: `Critical safety red-flag identified: ${emergencyMatch.matchedTrigger}. Immediate medical intervention required.`,
          follow_up_questions: [],
          first_aid_guidance: emergencyMatch.firstAid,
          disclaimer: 'Clinical decision support only. Not a medical diagnosis. Call 108/112 immediately in case of emergency.',
        },
        summary_text: `CRITICAL EMERGENCY ALERT: ${emergencyMatch.category}\nImmediate referral required (Call 108/112).\nChief Complaint: ${trimmedText}`,
      };

      return new Response(JSON.stringify(emergencyPayload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Groq AI Inference for Non-Emergency Symptoms
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      // Conservative Safe Fallback if Groq API key is not configured
      return new Response(
        JSON.stringify({
          success: true,
          triage_result: {
            risk_level: 'VISIT_PHC',
            risk_source: 'SAFETY_FALLBACK_NO_API_KEY',
            recommended_action: 'Please visit your nearest Primary Health Centre (PHC) for an in-person clinical check.',
            plain_language_explanation: 'Symptoms require clinical verification by a medical practitioner.',
            follow_up_questions: [],
            disclaimer: 'Informational decision support only. Does not replace a licensed medical practitioner.',
          },
          summary_text: `CLINICAL ADVISORY (Fallback):\nRecommended to consult local medical officer.\nSymptoms: ${trimmedText}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are SwasthaSathi, an Indian public healthcare triage decision support engine following MoHFW India and WHO IMNCI guidelines.
CRITICAL SAFETY CONSTRAINTS:
1. NEVER diagnose specific diseases (e.g., do NOT assert "You have Typhoid"). Say "Symptoms are consistent with acute fever".
2. NEVER prescribe drug dosages or prescription medications.
3. Categorize risk strictly into:
   - "VISIT_PHC": If symptoms persist, moderate fever, persistent cough, localized pain, or uncertain severity.
   - "HOME_CARE": Only for mild, self-limiting symptoms (mild cold, minor muscle soreness).
4. Output MUST be valid JSON adhering exactly to:
{
  "risk_level": "VISIT_PHC" | "HOME_CARE",
  "plain_language_explanation": "Simple 1-2 sentence explanation in requested language",
  "recommended_action": "Actionable next step (e.g. visit PHC clinic within 24-48 hours)",
  "follow_up_questions": ["Question 1?", "Question 2?"]
}`;

    const userPrompt = `Patient Language: ${language}
Symptoms: "${trimmedText}"
Follow-up responses: ${JSON.stringify(follow_ups)}
Assess the patient now and output JSON:`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('Groq API Error:', errText);
      throw new Error(`Groq API returned status ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const parsedAssessment = JSON.parse(groqData.choices[0].message.content);

    // Enforce safety floor: never allow LLM to suggest lower than rules
    const finalRisk = parsedAssessment.risk_level === 'HOME_CARE' ? 'HOME_CARE' : 'VISIT_PHC';

    const triageResult = {
      risk_level: finalRisk,
      risk_source: 'GROQ_LLM',
      recommended_action: parsedAssessment.recommended_action || 'Consult local medical officer at nearest PHC.',
      plain_language_explanation: parsedAssessment.plain_language_explanation || 'Assessment based on reported symptoms.',
      follow_up_questions: parsedAssessment.follow_up_questions || [],
      disclaimer: 'Clinical decision-support only. Not a medical diagnosis. Consult a doctor for diagnostic confirmation.',
    };

    const summaryText = `SWASTHASATHI ASHA REFERRAL MEMO\nRisk Level: ${finalRisk}\nChief Complaint: ${trimmedText}\nRecommendation: ${triageResult.recommended_action}\nGovernance: MoHFW Guidelines`;

    return new Response(
      JSON.stringify({
        success: true,
        triage_result: triageResult,
        summary_text: summaryText,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Triage Function Exception:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Internal server error in triage function',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
