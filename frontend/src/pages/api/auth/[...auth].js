import { tokenName, refreshTokenName } from "@/auth/custom";
import jwt from "jsonwebtoken";
import mysql from 'mysql2/promise';

const useDatabaseForUsers = process.env.CUSTOM_AUTH_DATABASE_ENABLED === '1'

const pool = useDatabaseForUsers ? mysql.createPool({
    host: process.env.CUSTOM_AUTH_DB_HOST,
    user: process.env.CUSTOM_AUTH_DB_USER,
    password: process.env.CUSTOM_AUTH_DB_PASSWORD,
    database: process.env.CUSTOM_AUTH_DB_NAME,
    port: process.env.CUSTOM_AUTH_DB_PORT,
    connectionLimit: 10,
}) : [];

const refreshTokenLongevity = '30d'
const jwtLongevity = '2m'

// Determines if the "Secure" attribute for a cookie gets set
// Disables itself if using localhost, basically.
const usingHttps = process.env.NEXT_PUBLIC_ROOT_URL.includes('https')

export default function handler(req, res) {
    if (process.env.NEXT_PUBLIC_AUTH_SYSTEM != 'custom'){
        return res.status(404)
    }

    const { auth } = req.query;
    const [action, provider] = auth;
  
    if (action === 'logout') {
        return handleLogout(req, res);
    }

    if (action === 'refresh') {
        return refresh(req, res);
    }
  
    const providerInstance = authProviders[provider];
  
    if (!providerInstance) {
        return res.status(404).json({ error: 'Provider not found' });
    }
  
    if (action === 'login') {
        return providerInstance.login(req, res);
    }
  
    if (action === 'callback') {
        return providerInstance.callback(req, res);
    }
  
    res.status(404).json({ error: 'Action not supported' });
}

/*

Implements the standard authorization code flow for OAuth2, the userinfo request for OpenID connect

Also creates/signs JWTs (session + refresh) and syncs up with a database if requested

Note: uses the "state" variable in the OAuth flow to transmit the callback URL as a base64 encoded string.

If database is enabled, the sub claim on the token is overwritten with the user ID in the database.

*/
export class BaseAuth {
    constructor(config) {
        // In config, need:
        // - code (i.e., 'github' or 'keycloak')
        // - clientId
        // - secret
        // - scopes (list)
        if (!config || !config.clientId || !config.code) {
            throw new Error('Configuration missing some important variables');
        }
        this.config = config;
        this.callbackUri = process.env.NEXT_PUBLIC_ROOT_URL + `/api/auth/callback/${config.code}`
    }

    async login(req, res) {
        const { returnUrl } = req.query
        const url = this.getLoginUrl()

        // Redirect the user to make the authorization request
        const urlParams = new URLSearchParams({
            scope: this.config.scopes.join(' '),
            redirect_uri: this.callbackUri,
            client_id: this.config.clientId,
            response_type: 'code',
            state: returnUrl ? this._encodeState({ returnUrl }) : this._encodeState({returnUrl: "/"})
        });
        const uri = `${url}?${urlParams.toString()}`;
        res.redirect(uri);
    }

    async getAccessToken(code){
        const response = await fetch(this.getTokenUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                client_id: this.config.clientId,
                client_secret: this.config.secret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.callbackUri,
            }),
        });
        const { access_token } = await response.json();
        return access_token
    }
  
    async callback(req, res) {

        // First check for the return url in the state variable
        const { state, code } = req.query;
        let returnUrl = "/"
        if (state) {
            const decodedState = this._decodeState(state);
            returnUrl = decodedState.returnUrl || '/';
        }

        // Make the access token request 
        const accessToken = await this.getAccessToken(code)

        // Get user info using provider-specific API
        const { userInfo, email } = await this.getUserData(accessToken)
        
        let userId = undefined
        if (useDatabaseForUsers) {
            try {
                userId = await getOrCreateUserId(email)
            }
            catch(e) {
                console.log(e)
                return res.status(500).end('Could not use database to check for user.')
            }
        }

        // Checks database for user if database feataure enabled; Creates or retrieves appropriate user id; Signs and stores JWT; redirects the user.
        const fullPayload = {...userInfo}
        if (userId){
            fullPayload['sub'] = userId
        }

        // Signs session and refresh tokens
        const token = jwt.sign(
            {...fullPayload},
            process.env.JWT_SECRET,
            {
                expiresIn: jwtLongevity, // Long-lived refresh token
                algorithm: 'HS256'
            }
        );

        const refreshToken = jwt.sign(
            {...fullPayload},
            process.env.REFRESH_TOKEN_SECRET,
            {
                expiresIn: refreshTokenLongevity, // Long-lived refresh token
                algorithm: 'HS256'
            }
        );

        res.setHeader('Set-Cookie', [
            `${tokenName}=${token}; Path=/`,
            `${refreshTokenName}=${refreshToken}; Path=/; HttpOnly;${usingHttps ? ' Secure' : ''}`
        ]);

        // Redirect the user back to his original URL, or the home page.
        if (returnUrl){
            res.redirect(returnUrl);
        }
        else {
            res.redirect('/');
        }
    }

    // Uses OpenID Connect.
    // For idiosynchratic APIs, re-implement this function, which takes the accessToken as an argument and returns the full userInfo object
    async getUserData(accessToken) {
        const userInfoResponse = await fetch(this.getUserInfoUrl(), {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const userInfo = await userInfoResponse.json();
        const email = userInfo['email']
        return { userInfo, email }  // Email separated out because it's required as an ID for the database check
    }

    // Authorization URL 
    getLoginUrl() {
        throw Error(`getLoginUrl for auth with code ${this.config.code} not implemented.`)
    }

    // Access token URL
    getTokenUrl() {
        throw Error(`getTokenUrl for auth with code ${this.config.code} not implemented.`)
    }

    // OpenID Connect URL
    getUserInfoUrl() {
        throw new Error(`getUserInfoURL for auth with code ${this.config.code} not implemented.`)
    }

    _encodeState(payload) {
        return Buffer.from(JSON.stringify({...payload})).toString('base64')
    }

    _decodeState(state) {
        return JSON.parse(Buffer.from(state, 'base64').toString());
    }
}

export class GitHubAuth extends BaseAuth {
    getLoginUrl() {
        return 'https://github.com/login/oauth/authorize';
    }

    getTokenUrl() {
        return 'https://github.com/login/oauth/access_token'
    }
  
    async getUserData(accessToken) {
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userInfo = await userResponse.json();
        const email = userInfo['email']
        return { userInfo, email }
    }
}

export class KeycloakAuth extends BaseAuth {
    getLoginUrl() {
        return `${this.config.publicUrl}/realms/${this.config.realm}/protocol/openid-connect/auth`;
    }

    getTokenUrl() {
        const serverUrl = this.config.privateUrl || this.config.publicUrl
        return `${serverUrl}/realms/${this.config.realm}/protocol/openid-connect/token`
    }

    getUserInfoUrl() {
        const serverUrl = this.config.privateUrl || this.config.publicUrl
        return `${serverUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`
    }
}

export class GoogleAuth extends BaseAuth {
    getLoginUrl() {
        return 'https://accounts.google.com/o/oauth2/v2/auth';
    }

    getTokenUrl() {
        return 'https://oauth2.googleapis.com/token'
    }
  
    getUserInfoUrl(){
        return `https://openidconnect.googleapis.com/v1/userinfo`
    }
}

export class BlankAuth extends BaseAuth {
    login(req, res) {
        const { returnUrl } = req.query
        const url = `/api/auth/callback/blank`
        // Redirect the user to make the authorization request
        const urlParams = new URLSearchParams({
            state: returnUrl ? this._encodeState({ returnUrl }) : this._encodeState({returnUrl: "/"})
        });
        const uri = `${url}?${urlParams.toString()}`;
        res.redirect(uri);
    }

    async getAccessToken(code) {
        return ""
    }

    async getUserData(accessToken) {
        return {
            'userInfo': {'name': 'Friend', 'email': 'default'},
            'email': 'default'
        }
    }
}

const authProviders = {}
if (process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === '1'){
    authProviders['github'] = new GitHubAuth({
        'code': 'github',
        'clientId': process.env.GITHUB_CLIENT_ID,
        'secret': process.env.GITHUB_SECRET,
        'scopes': ['user']
    })
}

if (process.env.NEXT_PUBLIC_KEYCLOAK_AUTH === '1'){
    authProviders['keycloak'] = new KeycloakAuth({
        'code': 'keycloak',
        'clientId': process.env.KEYCLOAK_CLIENT_ID,
        'secret': process.env.KEYCLOAK_SECRET,
        'realm': process.env.KEYCLOAK_REALM,
        'publicUrl': process.env.KEYCLOAK_PUBLIC_URL,
        'privateUrl': process.env.KEYCLOAK_PRIVATE_URL,
        'scopes': ['openid', 'profile', 'email'] 
    })
}

if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === '1'){
    authProviders['google'] = new GoogleAuth({
        'code': 'google',
        'clientId': process.env.GOOGLE_CLIENT_ID,
        'secret': process.env.GOOGLE_SECRET,
        'scopes': ['profile', 'email']
    })
}

if (!Object.keys(authProviders).length){
    authProviders['blank'] = new BlankAuth({
        // So we don't throw any errors in initialization
        'code': 'blank',
        'clientId': 'blank',
        'secret': 'blank',
        'scopes': []
    })
}

function handleLogout(req, res) {
    res.setHeader('Set-Cookie', [
        `${tokenName}=; Path=/`,
        `${refreshTokenName}=; Path=/; HttpOnly;${usingHttps ? ' Secure' : ''}`
    ]);
    res.redirect('/');
}


/*

On success, sends request with set cookie to new session token.

If refresh token not provided or expired, status 401 unauthorized.

*/
function refresh(req, res) {
    const refreshToken = req.cookies[refreshTokenName];
    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        delete decoded['exp']  // get rid of previous expiration
        delete decoded['iat']  // get rid of previous issued at
        const newSessionToken = jwt.sign(
            { ...decoded },
            process.env.JWT_SECRET,
            { expiresIn: jwtLongevity }
        );

        res.setHeader('Set-Cookie', `${tokenName}=${newSessionToken}; Path=/`);
        return res.status(200).json({ message: 'Token refreshed' });
    }
    catch (error) {
        return res.status(401).json({ message: 'Invalid refresh token' });
    }
}

async function getOrCreateUserId(email) {
    if (!email){
        throw new Error("Email is blank")
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM users WHERE `email` = ?', [email]);
        if (rows.length) {
            return rows[0].id;
        }
        else {
            const [insertResult] = await connection.query('INSERT INTO users (`email`) VALUES (?)', [email]);
            const newUserId = insertResult.insertId;
            
            await connection.commit();
            return newUserId;
        }
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
  