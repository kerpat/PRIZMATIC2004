(() => {
    const globalScope = typeof window !== 'undefined' ? window : global;

    const CONFIG_BASE = globalScope.CONFIG?.API_BASE_URL;
    const ROUTER_BASE = CONFIG_BASE || '/api/router';
    const DATA_ENDPOINT = `${ROUTER_BASE}?endpoint=data`;
    const ADMIN_ENDPOINT = `${ROUTER_BASE}?endpoint=admin`;
    const STORAGE_UPLOAD_ENDPOINT = `${ROUTER_BASE}?endpoint=storage-upload`;
    const STORAGE_DOWNLOAD_ENDPOINT = `${ROUTER_BASE}?endpoint=storage-download`;

    const AUTH_STORAGE_KEY = 'adminAuthToken';
    const AUTH_EMAIL_KEY = 'adminAuthEmail';

    const hasLocalStorage = (() => {
        try {
            const testKey = '__db_client__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('[db-client] localStorage unavailable:', error);
            return false;
        }
    })();

    const authStore = {
        get token() {
            if (!hasLocalStorage) return null;
            return window.localStorage.getItem(AUTH_STORAGE_KEY);
        },
        setToken(token) {
            if (!hasLocalStorage) return;
            if (token) {
                window.localStorage.setItem(AUTH_STORAGE_KEY, token);
            } else {
                window.localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        },
        get email() {
            if (!hasLocalStorage) return null;
            return window.localStorage.getItem(AUTH_EMAIL_KEY);
        },
        setEmail(email) {
            if (!hasLocalStorage) return;
            if (email) {
                window.localStorage.setItem(AUTH_EMAIL_KEY, email);
            } else {
                window.localStorage.removeItem(AUTH_EMAIL_KEY);
            }
        },
        clear() {
            this.setToken(null);
            this.setEmail(null);
        },
    };

    async function parseJsonResponse(response) {
        const text = await response.text();
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            console.error('[db-client] Failed to parse JSON response:', error, text);
            throw error;
        }
    }

    class DatabaseClient {
        constructor(config = {}) {
            this.dataEndpoint = config.dataEndpoint || DATA_ENDPOINT;
            this.adminEndpoint = config.adminEndpoint || ADMIN_ENDPOINT;
            this.storageUploadEndpoint = config.storageUploadEndpoint || STORAGE_UPLOAD_ENDPOINT;
            this.storageDownloadEndpoint = config.storageDownloadEndpoint || STORAGE_DOWNLOAD_ENDPOINT;
        }

        _buildHeaders(extra = {}) {
            const headers = { ...extra };
            const token = authStore.token;
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            return headers;
        }

        async _dataRequest(action, payload = {}) {
            const body = JSON.stringify({ action, ...payload });
            const response = await fetch(this.dataEndpoint, {
                method: 'POST',
                headers: this._buildHeaders({ 'Content-Type': 'application/json' }),
                body,
            });

            const data = await parseJsonResponse(response);
            if (!response.ok) {
                const message = data?.error || `Request failed with status ${response.status}`;
                return { data: null, error: { message } };
            }
            return data;
        }

        async _adminRequest(payload = {}) {
            const response = await fetch(this.adminEndpoint, {
                method: 'POST',
                headers: this._buildHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload),
            });
            const data = await parseJsonResponse(response);
            if (!response.ok) {
                const message = data?.error || `Admin request failed (${response.status})`;
                return { status: response.status, body: { error: message } };
            }
            return { status: response.status, body: data };
        }

        from(table) {
            return new QueryBuilder(this, table);
        }

        async rpc(functionName, params = {}) {
            return this._dataRequest('rpc', { function: functionName, params });
        }

        storage = {
            from: (bucket) => new StorageBucketClient(this, bucket),
        };
    }

    class QueryBuilder {
        constructor(client, table) {
            this.client = client;
            this.table = table;
            this.selectFields = '*';
            this.filters = [];
            this.orderBy = null;
            this.limitValue = null;
            this.offsetValue = null;
            this.isSingleRow = false;
            this.allowEmptySingle = false;
        }

        select(fields = '*') {
            this.selectFields = fields;
            return this;
        }

        eq(field, value) {
            this.filters.push({ field, operator: 'eq', value });
            return this;
        }

        neq(field, value) {
            this.filters.push({ field, operator: 'neq', value });
            return this;
        }

        gt(field, value) {
            this.filters.push({ field, operator: 'gt', value });
            return this;
        }

        gte(field, value) {
            this.filters.push({ field, operator: 'gte', value });
            return this;
        }

        lt(field, value) {
            this.filters.push({ field, operator: 'lt', value });
            return this;
        }

        lte(field, value) {
            this.filters.push({ field, operator: 'lte', value });
            return this;
        }

        like(field, value) {
            this.filters.push({ field, operator: 'like', value });
            return this;
        }

        ilike(field, value) {
            this.filters.push({ field, operator: 'ilike', value });
            return this;
        }

        in(field, values) {
            this.filters.push({ field, operator: 'in', value: values });
            return this;
        }

        is(field, value) {
            this.filters.push({ field, operator: 'is', value });
            return this;
        }

        order(field, options = {}) {
            const { ascending = true } = options;
            this.orderBy = { field, direction: ascending ? 'asc' : 'desc' };
            return this;
        }

        limit(count) {
            this.limitValue = count;
            return this;
        }

        range(from, to) {
            this.offsetValue = from;
            this.limitValue = to - from + 1;
            return this;
        }

        single() {
            this.isSingleRow = true;
            this.allowEmptySingle = false;
            return this;
        }

        maybeSingle() {
            this.isSingleRow = true;
            this.allowEmptySingle = true;
            return this;
        }

        async insert(payload) {
            return this.client._dataRequest('insert', {
                table: this.table,
                data: payload,
            });
        }

        async update(payload) {
            return this.client._dataRequest('update', {
                table: this.table,
                data: payload,
                filters: this.filters,
            });
        }

        async delete() {
            return this.client._dataRequest('delete', {
                table: this.table,
                filters: this.filters,
            });
        }

        async execute() {
            const response = await this.client._dataRequest('select', {
                table: this.table,
                select: this.selectFields,
                filters: this.filters,
                order: this.orderBy,
                limit: this.limitValue,
                offset: this.offsetValue,
                single: this.isSingleRow,
                maybeSingle: this.allowEmptySingle,
            });

            if (response?.error) {
                return { data: null, error: response.error };
            }

            let data = response?.data ?? null;
            if (this.isSingleRow && data && Array.isArray(data)) {
                data = data[0] ?? null;
            }

            if (!this.allowEmptySingle && this.isSingleRow && !data) {
                return {
                    data: null,
                    error: { message: 'Record not found', code: 'NO_ROWS' },
                };
            }

            return { data, error: null, count: response?.count ?? null };
        }

        then(resolve, reject) {
            return this.execute().then(resolve, reject);
        }
    }

    class StorageBucketClient {
        constructor(client, bucket) {
            this.client = client;
            this.bucket = bucket;
        }

        async upload(path, file, options = {}) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bucket', this.bucket);
            formData.append('path', path);
            if (options.userId) {
                formData.append('userId', options.userId);
            }

            const headers = {};
            const token = authStore.token;
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(this.client.storageUploadEndpoint, {
                method: 'POST',
                headers,
                body: formData,
            });

            const data = await parseJsonResponse(response);
            if (!response.ok || !data?.success) {
                const message = data?.error || `Upload failed (${response.status})`;
                return { data: null, error: { message } };
            }

            return {
                data: {
                    path: data.path,
                    publicUrl: data.publicUrl,
                    size: data.size,
                    type: data.type,
                },
                error: null,
            };
        }

        getPublicUrl(path) {
            const query = new URLSearchParams({ bucket: this.bucket, path });
            return {
                data: {
                    publicUrl: `${this.client.storageDownloadEndpoint}&${query.toString()}`,
                },
                error: null,
            };
        }

        async download(path) {
            const query = new URLSearchParams({ bucket: this.bucket, path });
            const url = `${this.client.storageDownloadEndpoint}&${query.toString()}`;
            const response = await fetch(url, {
                headers: this.client._buildHeaders(),
            });
            if (!response.ok) {
                const error = await parseJsonResponse(response);
                return { data: null, error: { message: error?.error || 'Download failed' } };
            }
            const blob = await response.blob();
            return { data: blob, error: null };
        }

        async list(prefix = '', options = {}) {
            try {
                const headers = this.client._buildHeaders({ 'Content-Type': 'application/json' });
                const response = await fetch(this.client.adminEndpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        action: 'list-storage-files',
                        bucket: this.bucket,
                        prefix: options?.prefix ?? prefix,
                    }),
                });

                const data = await parseJsonResponse(response);
                if (!response.ok) {
                    const message = data?.error || `List failed (${response.status})`;
                    return { data: null, error: { message } };
                }
                return { data: data?.files || [], error: null };
            } catch (error) {
                return { data: null, error: { message: error.message } };
            }
        }
    }

    class SupabaseAuthShim {
        constructor(client) {
            this.client = client;
            this.currentSession = null;

            const token = authStore.token;
            const email = authStore.email;
            if (token) {
                this.currentSession = {
                    access_token: token,
                    token_type: 'bearer',
                    user: email ? { email } : { email: 'admin' },
                    expires_in: 24 * 60 * 60,
                };
            }
        }

        _setSession(token, email) {
            if (!token) {
                authStore.clear();
                this.currentSession = null;
                return;
            }
            authStore.setToken(token);
            authStore.setEmail(email);
            this.currentSession = {
                access_token: token,
                token_type: 'bearer',
                user: email ? { email } : { email: 'admin' },
                expires_in: 24 * 60 * 60,
            };
        }

        async signInWithPassword({ email, password }) {
            const response = await this.client._adminRequest({
                action: 'login',
                email,
                password,
            });

            if (response.status !== 200) {
                return { data: null, error: { message: response.body?.error || 'Invalid credentials' } };
            }

            const token = response.body?.token;
            this._setSession(token, normalizeEmail(email));

            return {
                data: {
                    session: this.currentSession,
                    user: this.currentSession?.user || null,
                },
                error: null,
            };
        }

        async getSession() {
            return {
                data: { session: this.currentSession },
                error: null,
            };
        }

        async getUser() {
            return {
                data: { user: this.currentSession?.user || null },
                error: null,
            };
        }

        async signOut() {
            this._setSession(null, null);
            return { error: null };
        }
    }

    function normalizeEmail(value) {
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }

    class ChannelShim {
        constructor(name) {
            this.name = name;
            this.handlers = [];
            console.warn(`[supabase-shim] realtime channel "${name}" is not implemented. Falling back to no-op.`);
        }

        on() {
            return this;
        }

        subscribe(callback) {
            if (typeof callback === 'function') {
                callback('SUBSCRIBED');
            }
            return { data: { subscription: null }, error: null };
        }

        unsubscribe() {
            this.handlers = [];
            return Promise.resolve({ data: { message: 'unsubscribed' } });
        }
    }

    class SupabaseShim {
        constructor(client) {
            this._client = client;
            this.auth = new SupabaseAuthShim(client);
            this.storage = client.storage;
        }

        from(table) {
            return this._client.from(table);
        }

        rpc(functionName, params) {
            return this._client.rpc(functionName, params);
        }

        channel(name) {
            return new ChannelShim(name);
        }

        removeChannel(channel) {
            if (channel && typeof channel.unsubscribe === 'function') {
                channel.unsubscribe();
            }
        }
    }

    const sharedClient = new DatabaseClient();

    const supabaseFactory = {
        createClient() {
            return new SupabaseShim(sharedClient);
        },
    };

    globalScope.dbClient = sharedClient;
    globalScope.supabase = supabaseFactory;
})();
