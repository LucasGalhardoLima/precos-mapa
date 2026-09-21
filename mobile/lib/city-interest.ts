import { supabase } from '@/lib/supabase';

// The one contact the MLP collects (onboarding "Fora de Matão", decisão 9):
// an optional e-mail plus the city it asked about, only to announce that the
// Poup arrived there. Anonymous insert; the table is not readable from the
// app (supabase/migrations/079_city_interest.sql). Resolves false on any
// failure so the screen can say so instead of pretending it saved.
export async function saveCityInterest(city: string, email: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('city_interest').insert({ city: city.trim(), email: email.trim() });
    return !error;
  } catch {
    return false;
  }
}
