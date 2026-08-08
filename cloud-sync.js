// cloud-sync.js
//
// Optional real backend for Silent Grind. Leave SUPABASE_URL and
// SUPABASE_ANON_KEY blank and the app runs exactly as before —
// local-only, nothing changes. Fill them in (after running
// supabase-schema.sql in your own Supabase project) to get real
// cross-device sync via magic-link email auth.
//
// NOT TESTED against a live project — I don't have Supabase
// credentials to run this end-to-end. The API calls below are
// standard @supabase/supabase-js v2 usage, but verify this yourself
// (open the browser console, sign in, confirm rows appear in
// Table Editor -> kv_store) before relying on it for real data.

const SUPABASE_URL = '';       // e.g. 'https://xxxx.supabase.co'
const SUPABASE_ANON_KEY = '';  // anon/public key, not the service role key

window.SilentGrindCloud = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (typeof supabase === 'undefined') {
    console.warn('Supabase client script did not load — check the CDN tag order in silent-grind.html.');
    return null;
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;
  let ready = false;
  const listeners = new Set();

  client.auth.getSession().then(({ data }) => {
    currentUser = data.session?.user || null;
    ready = true;
    listeners.forEach((fn) => fn(currentUser));
  });

  client.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    listeners.forEach((fn) => fn(currentUser));
  });

  async function signIn(email) {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    return { error };
  }

  async function signOut() {
    await client.auth.signOut();
  }

  function onAuthChange(fn) {
    listeners.add(fn);
    if (ready) fn(currentUser);
    return () => listeners.delete(fn);
  }

  function getUser() {
    return currentUser;
  }

  async function get(key) {
    if (!currentUser) return null;
    const { data, error } = await client
      .from('kv_store')
      .select('value')
      .eq('user_id', currentUser.id)
      .eq('key', key)
      .maybeSingle();
    if (error) {
      console.warn('cloud get failed for', key, error);
      return null;
    }
    return data ? data.value : null;
  }

  async function set(key, value) {
    if (!currentUser) return;
    const { error } = await client
      .from('kv_store')
      .upsert({ user_id: currentUser.id, key, value }, { onConflict: 'user_id,key' });
    if (error) console.warn('cloud set failed for', key, error);
  }

  return { signIn, signOut, onAuthChange, getUser, get, set };
})();
