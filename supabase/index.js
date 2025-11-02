(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('@supabase/supabase-js'));
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root.supabase);
    });
  } else {
    root.SupabaseBridge = factory(root.supabase);
  }
})(typeof self !== 'undefined' ? self : this, function createSupabaseBridge(supabaseLib) {
  const isNodeRuntime = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
  const env = isNodeRuntime ? process.env : {};
  const globalConfig = typeof window !== 'undefined' ? (window.CONFIG || window.SUPABASE_CONFIG || {}) : {};

  // === Supabase environment keys ===
  const SUPABASE_URL = env?.SUPABASE_URL || globalConfig.SUPABASE_URL || null;
  const SUPABASE_ANON_KEY = env?.SUPABASE_ANON_KEY || globalConfig.SUPABASE_ANON_KEY || null;
  const SUPABASE_SERVICE_ROLE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY || null; // never exposed to browser

  let anonClient = null;
  let serviceRoleClient = null;
  let anonOptionsSignature = null;
  let serviceOptionsSignature = null;

  function assertSupabaseLibLoaded() {
    if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
      throw new Error('[SupabaseBridge] The Supabase library is not loaded. For browsers load https://cdn.jsdelivr.net/npm/@supabase/supabase-js before this script.');
    }
  }

  function getSupabaseAnonClient(options = {}) {
    assertSupabaseLibLoaded();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('[SupabaseBridge] SUPABASE_URL and SUPABASE_ANON_KEY must be configured.');
    }
    const serializedOptions = JSON.stringify(options || {});
    if (!anonClient || serializedOptions !== anonOptionsSignature) {
      anonClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
      anonOptionsSignature = serializedOptions;
    }
    return anonClient;
  }

  function getSupabaseServiceRoleClient(options = {}) {
    if (!isNodeRuntime) {
      throw new Error('[SupabaseBridge] Service role client may only be created in a server environment.');
    }
    assertSupabaseLibLoaded();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('[SupabaseBridge] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
    }
    const serializedOptions = JSON.stringify(options || {});
    if (!serviceRoleClient || serializedOptions !== serviceOptionsSignature) {
      serviceRoleClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options);
      serviceOptionsSignature = serializedOptions;
    }
    return serviceRoleClient;
  }

  function getSupabaseConfig() {
    return {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: isNodeRuntime ? SUPABASE_SERVICE_ROLE_KEY : undefined
    };
  }

  function resetSupabaseClients() {
    anonClient = null;
    serviceRoleClient = null;
    anonOptionsSignature = null;
    serviceOptionsSignature = null;
  }

  return {
    getSupabaseAnonClient,
    getSupabaseServiceRoleClient,
    getSupabaseConfig,
    resetSupabaseClients
  };
});
