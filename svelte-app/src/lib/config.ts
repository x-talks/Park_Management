// Runtime config — resolves Supabase + Worker endpoints.
// Defaults to production (same values as the current app's js/config.js).
// Override via Vite env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// VITE_WORKER_URL) for staging — e.g. an .env file in CI.

const PROD = {
	supabaseUrl: 'https://fnluagvzowbcuzlblfmr.supabase.co',
	supabaseKey:
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubHVhZ3Z6b3diY3V6bGJsZm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTgxNjQsImV4cCI6MjA5NTk3NDE2NH0.aoQFZ-H-AhLv2EA5dXGYxRSU_lK21CXqdNBHK7c728c',
	workerUrl: 'https://park-management-api.aenumina.workers.dev'
} as const;

export const config = {
	supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? PROD.supabaseUrl,
	supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? PROD.supabaseKey,
	workerUrl: import.meta.env.VITE_WORKER_URL ?? PROD.workerUrl
};
