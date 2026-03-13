import { supabase } from './supabase';
import * as Icons from 'lucide-react';

export interface Job {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  salary: string;
  location: string;
  type: string;
  techStack: string[];
  requirements: string[];
  benefits: { icon_name: string; text: string }[];
  responsibilities: string[];
  softSkills: string[];
  workEnvironment: { icon_name: string; text: string }[];
  paymentTerms: { icon_name: string; text: string }[];
  team: string[];
  is_active: boolean;
}

// Helper to map icon name to Lucide component
export const getIcon = (iconName: string) => {
  const IconComponent = (Icons as any)[iconName];
  return IconComponent || Icons.HelpCircle;
};

export const jobsService = {
  async getJobs(): Promise<Job[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(job => ({
      ...job,
      shortDescription: job.short_description,
      fullDescription: job.full_description,
      techStack: job.tech_stack,
      softSkills: job.soft_skills,
      workEnvironment: job.work_environment,
      paymentTerms: job.payment_terms,
      is_active: job.is_active
    }));
  },

  async getAllJobsForAdmin(): Promise<Job[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(job => ({
      ...job,
      shortDescription: job.short_description,
      fullDescription: job.full_description,
      techStack: job.tech_stack,
      softSkills: job.soft_skills,
      workEnvironment: job.work_environment,
      paymentTerms: job.payment_terms,
      is_active: job.is_active
    }));
  },

  async toggleJobStatus(id: string, currentStatus: boolean): Promise<void> {
    const { error } = await supabase
      .from('jobs')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) throw error;
  },

  async getJobBySlug(slug: string): Promise<Job> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    
    return {
      ...data,
      shortDescription: data.short_description,
      fullDescription: data.full_description,
      techStack: data.tech_stack,
      softSkills: data.soft_skills,
      workEnvironment: data.work_environment,
      paymentTerms: data.payment_terms
    };
  },

  async createJob(jobData: Partial<Job>) {
    const slug = jobData.title?.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
      .from('jobs')
      .insert([{
        slug,
        title: jobData.title,
        short_description: jobData.shortDescription,
        full_description: jobData.fullDescription,
        salary: jobData.salary,
        location: jobData.location,
        type: jobData.type,
        tech_stack: jobData.techStack,
        requirements: jobData.requirements,
        responsibilities: jobData.responsibilities,
        soft_skills: jobData.softSkills,
        team: jobData.team,
        benefits: jobData.benefits,
        work_environment: jobData.workEnvironment,
        payment_terms: jobData.paymentTerms,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
