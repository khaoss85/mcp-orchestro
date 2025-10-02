import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';

export interface ProjectInfo {
  id: string;
  name: string;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const PROJECT_CACHE_KEY = 'project:current';
const PROJECT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (rarely changes)

// Get or create the default project
export async function getProjectInfo(): Promise<ProjectInfo> {
  // Check cache first
  const cached = cache.get<ProjectInfo>(PROJECT_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    // Try to get existing project
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .limit(1)
      .single();

    if (!fetchError && projects) {
      // Cache and return existing project
      cache.set(PROJECT_CACHE_KEY, projects, PROJECT_CACHE_TTL);
      return projects;
    }

    // No project exists, create default one
    const { data: newProject, error: createError } = await supabase
      .from('projects')
      .insert({
        name: 'MCP Coder Expert',
        status: 'active',
        description: 'AI-powered task management and knowledge system',
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create project: ${createError.message}`);
    }

    // Cache and return new project
    cache.set(PROJECT_CACHE_KEY, newProject, PROJECT_CACHE_TTL);
    return newProject;
  });
}

export async function updateProjectStatus(status: string): Promise<ProjectInfo> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    // Get current project first
    const current = await getProjectInfo();

    // Update status
    const { data, error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', current.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project status: ${error.message}`);
    }

    // Invalidate cache
    cache.delete(PROJECT_CACHE_KEY);

    return data;
  });
}
