/**
 * Supabase Edge Function: Laboratory Report Explainer
 * Strictly evaluates laboratory values against printed reference ranges to avoid diagnosis hallucinations.
 */
import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface LabItem {
  test_name: string;
  value: number;
  unit: string;
  printed_range: string;
  flag: 'BELOW_PRINTED_RANGE' | 'WITHIN_PRINTED_RANGE' | 'ABOVE_PRINTED_RANGE' | 'UNKNOWN';
  plain_explanation: string;
}

const COMMON_TESTS: Record<string, string> = {
  'hemoglobin': 'Hemoglobin is an iron-rich protein in red blood cells that carries oxygen throughout your body.',
  'hb': 'Hemoglobin is an iron-rich protein in red blood cells that carries oxygen throughout your body.',
  'wbc': 'White Blood Cells are part of your immune system that help fight infections.',
  'platelet': 'Platelets are tiny blood cells that help your body form clots to stop bleeding.',
  'glucose': 'Blood glucose measures the sugar level in your bloodstream.',
  'creatinine': 'Creatinine is a waste product filtered by your kidneys to monitor kidney function.',
  'bilirubin': 'Bilirubin is a yellowish substance produced during normal breakdown of red blood cells.',
  'tsh': 'Thyroid Stimulating Hormone controls how your body uses energy.',
};

function parseLabReport(text: string): LabItem[] {
  const items: LabItem[] = [];
  const lines = text.split('\n');

  // Regex pattern matching: TestName: Value Unit (ref min - max) or [min - max]
  const pattern = /([A-Za-z\s]+)[:\-=\s]+([\d,\.]+)\s*([a-zA-Z\/\%μ]+)?\s*[\(\[]?(?:ref|range)?\s*([\d,\.]+)\s*[\-\–to]+\s*([\d,\.]+)?[\)\]]?/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(pattern);
    if (match) {
      const name = match[1].trim();
      const valStr = match[2].replace(/,/g, '');
      const unit = match[3] ? match[3].trim() : '';
      const minStr = match[4] ? match[4].replace(/,/g, '') : null;
      const maxStr = match[5] ? match[5].replace(/,/g, '') : null;

      const val = parseFloat(valStr);
      if (isNaN(val)) continue;

      let flag: 'BELOW_PRINTED_RANGE' | 'WITHIN_PRINTED_RANGE' | 'ABOVE_PRINTED_RANGE' | 'UNKNOWN' = 'UNKNOWN';
      let rangeDisplay = 'Not specified';

      if (minStr && maxStr) {
        const minVal = parseFloat(minStr);
        const maxVal = parseFloat(maxStr);
        rangeDisplay = `${minVal} - ${maxVal} ${unit}`.trim();

        if (val < minVal) {
          flag = 'BELOW_PRINTED_RANGE';
        } else if (val > maxVal) {
          flag = 'ABOVE_PRINTED_RANGE';
        } else {
          flag = 'WITHIN_PRINTED_RANGE';
        }
      }

      const lowerName = name.toLowerCase();
      let explanation = 'General clinical laboratory parameter.';
      for (const [key, expl] of Object.entries(COMMON_TESTS)) {
        if (lowerName.includes(key)) {
          explanation = expl;
          break;
        }
      }

      items.push({
        test_name: name,
        value: val,
        unit: unit,
        printed_range: rangeDisplay,
        flag: flag,
        plain_explanation: explanation,
      });
    }
  }

  return items;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Report text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = parseLabReport(text);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          items: items,
          note: 'Flags compare only against the printed reference ranges on the report. Please discuss results with your doctor.',
          raw_text: text,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Report Function Exception:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Error analyzing lab report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
