from pathlib import Path
path = Path('api/index.js')
lines = path.read_text(encoding='utf-8').splitlines()
for i, line in enumerate(lines):
    if 'return handleAuth(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handleAuth(req, res, ensureSupabaseAdmin());'
    if 'return handlePayments(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handlePayments(req, res, ensureSupabaseAdmin());'
    if 'return handleWebhook(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handleWebhook(req, res, ensureSupabaseAdmin());'
    if 'return handleUser(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handleUser(req, res, ensureSupabaseAdmin());'
    if 'return handleAdmin(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handleAdmin(req, res, ensureSupabaseAdmin());'
    if 'return handleData(req, res, supabaseAdmin);' in line:
        lines[i] = '                return handleData(req, res, ensureSupabaseAdmin());'
    if 'const { data: bike, error: bikeError } = await supabaseAdmin' in line:
        lines[i-4:i-4] = []  # cannot easily insert; skip
