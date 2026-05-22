import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getUrlParams() {
  const searchParams = new URLSearchParams(window.location.search);
  let u = searchParams.get('u');
  let k = searchParams.get('k');

  if (!u || !k) {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(hash.substring(qIndex));
      u = u || hashParams.get('u');
      k = k || hashParams.get('k');
    }
  }
  return { u, k };
}

export function getSupabase() {
  if (supabase) return supabase;

  let url = localStorage.getItem('supabase_url');
  let key = localStorage.getItem('supabase_key');

  if (!url || !key) {
    url = sessionStorage.getItem('temp_supabase_url');
    key = sessionStorage.getItem('temp_supabase_key');
  }

  if (!url || !key) {
    const params = getUrlParams();
    if (params.u && params.k) {
      url = params.u;
      key = params.k;
      sessionStorage.setItem('temp_supabase_url', url);
      sessionStorage.setItem('temp_supabase_key', key);
    }
  }

  if (url && key) {
    supabase = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    return supabase;
  }
  return null;
}

export function initSupabase(url, key) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  supabase = createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
  return supabase;
}

export function isCloudEnabled() {
  return !!getSupabase();
}

