/**
 * Deploys all bundled Edge Functions to the user's Supabase project
 * using the Supabase Management API.
 *
 * Requires a personal access token from:
 * https://supabase.com/dashboard/account/tokens
 */

import { edgeFunctions, type EdgeFunctionBundle } from './index';

export interface DeployProgress {
  current: number;
  total: number;
  functionName: string;
  status: 'deploying' | 'success' | 'error';
  error?: string;
}

export interface DeployResult {
  success: boolean;
  deployed: string[];
  errors: Array<{ slug: string; error: string }>;
}

/**
 * Extract the Supabase project ref from the project URL.
 * e.g. "https://abc123.supabase.co" -> "abc123"
 */
function extractProjectRef(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

/**
 * Check if an Edge Function already exists in the project.
 */
async function functionExists(
  projectRef: string,
  slug: string,
  accessToken: string
): Promise<boolean> {
  const response = await fetch(
    `/api/supabase-mgmt/v1/projects/${projectRef}/functions/${slug}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return response.ok;
}

/**
 * Create a new Edge Function (metadata only).
 */
async function createFunction(
  projectRef: string,
  fn: EdgeFunctionBundle,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `/api/supabase-mgmt/v1/projects/${projectRef}/functions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: fn.slug,
        name: fn.name,
        verify_jwt: fn.verifyJwt,
        body: fn.source,
      }),
    }
  );

  if (response.ok || response.status === 201) {
    return { ok: true };
  }

  const text = await response.text();

  // If function already exists, that is handled separately
  if (response.status === 409) {
    return { ok: false, error: 'EXISTS' };
  }

  return { ok: false, error: `HTTP ${response.status}: ${text}` };
}

/**
 * Update an existing Edge Function with new source code.
 */
async function updateFunction(
  projectRef: string,
  fn: EdgeFunctionBundle,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `/api/supabase-mgmt/v1/projects/${projectRef}/functions/${fn.slug}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fn.name,
        verify_jwt: fn.verifyJwt,
        body: fn.source,
      }),
    }
  );

  if (response.ok) {
    return { ok: true };
  }

  const text = await response.text();
  return { ok: false, error: `HTTP ${response.status}: ${text}` };
}

/**
 * Deploy a single Edge Function: create if new, update if it exists.
 */
async function deploySingleFunction(
  projectRef: string,
  fn: EdgeFunctionBundle,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  // Check if function already exists
  const exists = await functionExists(projectRef, fn.slug, accessToken);

  if (exists) {
    // Update existing function
    return updateFunction(projectRef, fn, accessToken);
  }

  // Try to create new function
  const createResult = await createFunction(projectRef, fn, accessToken);

  if (createResult.ok) {
    return { ok: true };
  }

  // If create returned EXISTS (race condition), try update
  if (createResult.error === 'EXISTS') {
    return updateFunction(projectRef, fn, accessToken);
  }

  return createResult;
}

/**
 * Deploy all bundled Edge Functions to the user's Supabase project.
 *
 * @param supabaseUrl - The Supabase project URL (e.g. https://abc123.supabase.co)
 * @param accessToken - Personal access token from supabase.com/dashboard/account/tokens
 * @param onProgress  - Optional callback for progress updates
 * @returns Deployment result with success status and any errors
 */
export async function deployEdgeFunctions(
  supabaseUrl: string,
  accessToken: string,
  onProgress?: (progress: DeployProgress) => void
): Promise<DeployResult> {
  const projectRef = extractProjectRef(supabaseUrl);

  if (!projectRef) {
    return {
      success: false,
      deployed: [],
      errors: [
        {
          slug: '*',
          error:
            'Nao foi possivel extrair o project ref da URL. ' +
            'A URL deve seguir o padrao https://<projeto>.supabase.co',
        },
      ],
    };
  }

  // Validate the access token by listing functions
  const validateResponse = await fetch(
    `/api/supabase-mgmt/v1/projects/${projectRef}/functions`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!validateResponse.ok) {
    const text = await validateResponse.text();
    return {
      success: false,
      deployed: [],
      errors: [
        {
          slug: '*',
          error:
            validateResponse.status === 401
              ? 'Access Token invalido ou expirado. Gere um novo em supabase.com/dashboard/account/tokens'
              : `Erro ao validar token: HTTP ${validateResponse.status} - ${text}`,
        },
      ],
    };
  }

  const total = edgeFunctions.length;
  const deployed: string[] = [];
  const errors: Array<{ slug: string; error: string }> = [];

  for (let i = 0; i < edgeFunctions.length; i++) {
    const fn = edgeFunctions[i]!;

    onProgress?.({
      current: i + 1,
      total,
      functionName: fn.name,
      status: 'deploying',
    });

    const result = await deploySingleFunction(projectRef, fn, accessToken);

    if (result.ok) {
      deployed.push(fn.slug);
      onProgress?.({
        current: i + 1,
        total,
        functionName: fn.name,
        status: 'success',
      });
    } else {
      errors.push({ slug: fn.slug, error: result.error ?? 'Erro desconhecido' });
      onProgress?.({
        current: i + 1,
        total,
        functionName: fn.name,
        status: 'error',
        error: result.error,
      });
    }
  }

  return {
    success: errors.length === 0,
    deployed,
    errors,
  };
}
