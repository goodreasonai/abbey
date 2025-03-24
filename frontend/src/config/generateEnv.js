const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const settingsPath = '/etc/abbey/settings.yml'
const envPath = '/etc/abbey/.env'

try {
    const settings = yaml.load(fs.readFileSync(settingsPath, 'utf8'));
    const env = dotenv.parse(fs.readFileSync(envPath));

    let envContent = '';
    function addEnv(name, val){
        const escaped = (''+val).replace(/'/g, "\\'")
        envContent += `${name}='${escaped}'\n`
    }

    // Tries to fix common mistakes when entering in URLs
    function fixUrl(url){
        return url.replace(/\/+$/, '');  // removes trailing slashes
    }

    // Defaults to ports 5000 / 3000 and "backend" name for the service on the internal network.
    let public_backend_url = "http://localhost:5000"
    let public_frontend_url = "http://localhost:3000"
    let internal_backend_url = "http://backend:5000"
    if (settings.services?.backend?.public_url){
        public_backend_url = fixUrl(settings.services?.backend?.public_url)
    }
    if (settings.services?.frontend?.public_url){
        public_frontend_url = fixUrl(settings.services?.frontend?.public_url)
    }
    if (settings.services?.backend?.internal_url){
        internal_backend_url = fixUrl(settings.services?.backend?.internal_url)
    }
    addEnv('NEXT_PUBLIC_BACKEND_URL', public_backend_url)
    addEnv('NEXT_PUBLIC_ROOT_URL', public_frontend_url)
    addEnv('NEXT_SERVER_SIDE_BACKEND_URL', internal_backend_url)

    // Auth
    // "system" is blank then we're using custom auth
    if (!settings['auth']?.system || settings['auth'].system == 'custom'){
        addEnv('NEXT_PUBLIC_AUTH_SYSTEM', 'custom')
        if (env['CUSTOM_AUTH_SECRET']){
            addEnv('JWT_SECRET', env['CUSTOM_AUTH_SECRET'])
            if (env['REFRESH_TOKEN_SECRET']){
                addEnv('REFRESH_TOKEN_SECRET', env['REFRESH_TOKEN_SECRET'])
            }
            else {
                addEnv('REFRESH_TOKEN_SECRET', env['CUSTOM_AUTH_SECRET'])
            }
        }
        else {
            addEnv('JWT_SECRET', 'not-a-secret')  // Matched on backend (see there if you want to change it)
            addEnv('REFRESH_TOKEN_SECRET', 'not-a-secret')
        }
        // Add any appropriate provider keys
        if (settings.auth?.providers?.length){
            for (const provider of settings.auth.providers){
                const lcProvider = provider.toLowerCase()
                if (lcProvider == 'google'){
                    if (!env['GOOGLE_CLIENT_ID'] || !env['GOOGLE_SECRET']){
                        console.log("WARNING: No client id or secret found in .env despite Google being enabled for auth; you must acquire a client ID and secret to enable Google for auth.")
                    }
                    else {
                        addEnv('NEXT_PUBLIC_ENABLE_GOOGLE_AUTH', 1)
                        addEnv('GOOGLE_CLIENT_ID', env['GOOGLE_CLIENT_ID'])
                        addEnv('GOOGLE_SECRET', env['GOOGLE_SECRET'])
                    }
                }
                else if (lcProvider == 'github'){
                    if (!env['GITHUB_CLIENT_ID'] || !env['GITHUB_SECRET']){
                        console.log("WARNING: No client id or secret found in .env despite GitHub being enabled for auth; you must acquire a client ID and secret to enable GitHub for auth.")
                    }
                    else {
                        addEnv('NEXT_PUBLIC_ENABLE_GITHUB_AUTH', 1)
                        addEnv('GITHUB_CLIENT_ID', env['GITHUB_CLIENT_ID'])
                        addEnv('GITHUB_SECRET', env['GITHUB_SECRET'])
                    }
                }
                else if (lcProvider == 'keycloak'){
                    if (!env['KEYCLOAK_PUBLIC_URL'] || !env['KEYCLOAK_REALM'] || !env['KEYCLOAK_SECRET'] || !env['KEYCLOAK_CLIENT_ID']){
                        console.log("WARNING: No url, realm, secret, or client id found for Keycloak; you must provide these in .env to enable Keycloak for auth.")
                    }
                    else {
                        addEnv('NEXT_PUBLIC_ENABLE_KEYCLOAK_AUTH', 1)
                        addEnv('KEYCLOAK_PUBLIC_URL', env['KEYCLOAK_PUBLIC_URL'])
                        if (env['KEYCLOAK_INTERNAL_URL']){
                            addEnv('KEYCLOAK_INTERNAL_URL', env['KEYCLOAK_INTERNAL_URL'])
                        }
                        addEnv('KEYCLOAK_REALM', env['KEYCLOAK_REALM'])
                        addEnv('KEYCLOAK_SECRET', env['KEYCLOAK_SECRET'])
                        addEnv('KEYCLOAK_CLIENT_ID', env['KEYCLOAK_CLIENT_ID'])
                    }
                }
            }
        }
        addEnv('CUSTOM_AUTH_DATABASE_ENABLED', 1)
        addEnv('CUSTOM_AUTH_DB_HOST', env.CUSTOM_AUTH_DB_ENDPOINT || env.DB_ENDPOINT || 'mysql')
        addEnv('CUSTOM_AUTH_DB_USER', env.CUSTOM_AUTH_DB_USER || env.DB_USER || 'root')
        addEnv('CUSTOM_AUTH_DB_PASSWORD', env.CUSTOM_AUTH_DB_PASSWORD || env.DB_PASSWORD || env.MYSQL_ROOT_PASSWORD)
        addEnv('CUSTOM_AUTH_DB_NAME', env.CUSTOM_AUTH_DB_NAME || env.DB_NAME || 'custom_auth')
        addEnv('CUSTOM_AUTH_DB_PORT', env.CUSTOM_AUTH_DB_PORT || env.DB_PORT || 3306)
    }
    else {
        addEnv('NEXT_PUBLIC_AUTH_SYSTEM', 'clerk')
        addEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env['CLERK_PUBLISHABLE_KEY'])
        addEnv('CLERK_SECRET_KEY', env['CLERK_SECRET_KEY'])
        addEnv('NEXT_PUBLIC_LONG_TOKEN_NAME', 'long-token')
    }

    // TTS
    // Looks for any non disabled option (from the root) that has a non empty "tts" list
    if (!settings.tts?.voices?.length){
        addEnv('NEXT_PUBLIC_HIDE_TTS', 1)
    }

    // Web
    // TTS
    // Looks for any non disabled option (from the root) that has a non empty "tts" list
    if (!settings.web?.engines?.length){
        addEnv('NEXT_PUBLIC_DISABLE_WEB', 1)
    }

    // Collections - by default disabled
    if (!(settings.collections?.disabled === false)){
        addEnv('NEXT_PUBLIC_HIDE_COLLECTIONS', 1)
    }
    else {
        addEnv('NEXT_PUBLIC_HIDE_COLLECTIONS', 0)
    }

    // Stripe
    if (env['STRIPE_PUBLISHABLE_KEY']){
        addEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', env['STRIPE_PUBLISHABLE_KEY'])
    }

    // Appearance
    if (settings.appearance?.show_signed_out_homepage === true){
        addEnv('NEXT_PUBLIC_HIDE_SIGNED_OUT_HOME_PAGE', 0)
    }
    else {
        addEnv('NEXT_PUBLIC_HIDE_SIGNED_OUT_HOME_PAGE', 1)
    }

    if (settings.name){
        addEnv('NEXT_PUBLIC_APP_NAME', settings.name)
    }

    // Subscriptions
    if (settings.subscriptions){
        addEnv('NEXT_PUBLIC_ENABLE_SUBSCRIPTION', 1)
    }

    // Images
    if (settings.images?.domains?.length){
        let domainList = settings.images.domains.join(",")
        addEnv('IMAGE_DOMAINS', domainList)
    }

    if (settings.chrome_ext){
        addEnv('CHROME_EXT_PROMO_LINK', settings.chrome_ext)
    }

    // Experimental templates
    if (settings.templates?.experimental){
        addEnv('NEXT_PUBLIC_EXPERIMENTAL_TEMPLATES', 1)
    }

    // Alerts
    if (settings.alert){
        addEnv('NEXT_PUBLIC_ALERT', settings.alert)
    }

    fs.writeFileSync(path.join(__dirname, '../../.env.local'), envContent);
    console.log('Environment variables generated successfully');
} catch (e) {
    console.error('Error generating environment variables:', e);
}
