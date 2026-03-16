import { Job } from "../services/jobs";

/**
 * Interface for the translated job content in JSON files
 */
interface TranslatedJobData {
  title: string;
  shortDescription: string;
  fullDescription?: string;
  salary: string;
  type: string;
  location: string;
  benefits?: string[];
  requirements?: string[];
  responsibilities?: string[];
  workEnvironment?: string[];
  paymentTerms?: string[];
  softSkills?: string[];
  team?: string[];
}

/**
 * Localizes a job object based on the current language and translations.
 * If translations are missing for a specific field, it falls back to the original job data.
 */
export const localizeJob = (job: Job, t: any): Job => {
  // Use a unique key based on the job slug as defined in translations
  // We check if "jobs.data.[slug]" exists
  const translatedData = t(`jobs.data.${job.slug}`, { returnObjects: true });

  console.log(`[localizeJob] Slug: ${job.slug}`);
  console.log(`[localizeJob] Job fields:`, {
    hasBenefits: !!job.benefits,
    hasWorkEnv: !!job.workEnvironment,
    hasPayment: !!job.paymentTerms
  });
  console.log(`[localizeJob] Translated Data:`, translatedData);

  // If the returned value is just the key string, it means it wasn't found
  if (typeof translatedData === 'string' || !translatedData || translatedData === `jobs.data.${job.slug}`) {
    console.log(`[localizeJob] Translation NOT found for slug: ${job.slug}`);
    return job;
  }

  const data = translatedData as Partial<TranslatedJobData>;

  return {
    ...job,
    title: data.title || job.title,
    shortDescription: data.shortDescription || job.shortDescription,
    fullDescription: data.fullDescription || job.fullDescription,
    salary: data.salary || job.salary,
    type: data.type || job.type,
    location: data.location || job.location,
    // For arrays, we map them if sizes match or just use them if they are replacement sets
    requirements: data.requirements || job.requirements || [],
    responsibilities: data.responsibilities || job.responsibilities || [],
    softSkills: data.softSkills || job.softSkills || [],
    team: data.team || job.team || [],
    techStack: job.techStack || [],
    
    // Map complex objects with guards
    benefits: (job.benefits || []).map((benefit, index) => ({
      ...benefit,
      text: (data.benefits && data.benefits[index]) ? data.benefits[index] : (benefit?.text || '')
    })),
    
    workEnvironment: (job.workEnvironment || []).map((item, index) => ({
      ...item,
      text: (data.workEnvironment && data.workEnvironment[index]) ? data.workEnvironment[index] : (item?.text || '')
    })),
    
    paymentTerms: (job.paymentTerms || []).map((item, index) => ({
      ...item,
      text: (data.paymentTerms && data.paymentTerms[index]) ? data.paymentTerms[index] : (item?.text || '')
    }))
  };
};
