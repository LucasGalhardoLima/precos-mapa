import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlatformStats, Testimonial } from '@/types';

export function useSocialProof() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [statsRes, testimonialsRes] = await Promise.all([
        supabase
          .from('platform_stats')
          .select('*')
          .eq('id', 1)
          .single(),
        supabase
          .from('testimonials')
          .select('*')
          .order('sort_order'),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (testimonialsRes.data) setTestimonials(testimonialsRes.data);
      setIsLoading(false);
    }

    fetch();
  }, []);

  return {
    stats: stats
      ? {
          userCount: stats.user_count,
          cityName: stats.city_name,
          avgMonthlySavings: stats.avg_monthly_savings,
        }
      : { userCount: '...', cityName: '...', avgMonthlySavings: '...' },
    testimonials,
    isLoading,
  };
}
