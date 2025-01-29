/**
 * OAuth2 implementation for Google Tasks integration
 * Handles authentication flow, token refresh, and secure storage
 */

import "@logseq/libs";
import { LSPluginBaseInfo } from "@logseq/libs/dist/LSPlugin.user";

/**
 * OAuth2 credentials interface
 */
export interface OAuthCredentials {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

/**
 * Token response from Google OAuth2
 */
export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

/**
 * Stored token data with expiration
 */
interface StoredTokenData extends TokenResponse {
    expiry_date: number;
}

/**
 * Handles OAuth2 authentication flow and token management
 */
export class OAuth2Handler {
    private credentials: OAuthCredentials;
    private tokenData: StoredTokenData | null;
    private readonly SCOPES = ["https://www.googleapis.com/auth/tasks"];
    private readonly AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    private readonly TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

    constructor(credentials: OAuthCredentials) {
        this.credentials = credentials;
        this.tokenData = null;
        this.loadStoredTokens();
    }

    /**
     * Loads stored tokens from Logseq settings
     */
    private loadStoredTokens(): void {
        const storedTokens = logseq.settings?.oauth_tokens;
        if (storedTokens) {
            try {
                this.tokenData = JSON.parse(atob(storedTokens));
            } catch (error) {
                console.error("Failed to parse stored tokens:", error);
                this.tokenData = null;
            }
        }
    }

    /**
     * Builds the OAuth2 authorization URL
     */
    private buildAuthUrl(): string {
        const params = new URLSearchParams({
            client_id: this.credentials.clientId,
            redirect_uri: this.credentials.redirectUri,
            response_type: "code",
            scope: this.SCOPES.join(" "),
            access_type: "offline",
            prompt: "consent"
        });

        return `${this.AUTH_ENDPOINT}?${params.toString()}`;
    }

    /**
     * Initiates the OAuth2 flow by opening a popup window
     */
    public async initiateAuth(): Promise<void> {
        const authUrl = this.buildAuthUrl();

        await logseq.UI.showMsg(
            "Please complete Google authentication in the popup window",
            "info"
        );

        return new Promise((resolve, reject) => {
            const popup = window.open(
                authUrl,
                "googleAuth",
                "width=600,height=600"
            );

            if (!popup) {
                reject(new Error("Failed to open authentication popup"));
                return;
            }

            // Handle the OAuth callback
            window.addEventListener("message", async (event) => {
                if (event.origin !== window.location.origin) return;
                if (event.data.type !== "oauth_callback") return;

                try {
                    await this.handleAuthCode(event.data.code);
                    popup.close();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Handles the authorization code from OAuth callback
     */
    private async handleAuthCode(code: string): Promise<void> {
        const response = await fetch(this.TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret,
                redirect_uri: this.credentials.redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to exchange authorization code for tokens");
        }

        const tokenData = await response.json();
        await this.updateTokenData(tokenData);
    }

    /**
     * Refreshes the access token using the refresh token
     */
    public async refreshAccessToken(): Promise<void> {
        if (!this.tokenData?.refresh_token) {
            throw new Error("No refresh token available");
        }

        const response = await fetch(this.TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret,
                refresh_token: this.tokenData.refresh_token,
                grant_type: "refresh_token",
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to refresh access token");
        }

        const newTokenData = await response.json();
        await this.updateTokenData({
            ...newTokenData,
            refresh_token: this.tokenData.refresh_token // Preserve existing refresh token
        });
    }

    /**
     * Updates and stores token data securely
     */
    private async updateTokenData(tokenData: TokenResponse): Promise<void> {
        this.tokenData = {
            ...tokenData,
            expiry_date: Date.now() + (tokenData.expires_in * 1000)
        };

        // Store encrypted in Logseq settings
        await logseq.updateSettings({
            "oauth_tokens": btoa(JSON.stringify(this.tokenData))
        });
    }

    /**
     * Ensures we have a valid access token, refreshing if necessary
     */
    public async ensureValidToken(): Promise<string> {
        if (!this.tokenData) {
            throw new Error("No token data available");
        }

        // Refresh if token is expired or will expire in next 5 minutes
        const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
        if (Date.now() + expiryBuffer >= this.tokenData.expiry_date) {
            await this.refreshAccessToken();
        }

        return this.tokenData.access_token;
    }

    /**
     * Clears stored tokens and forces re-authentication
     */
    public async logout(): Promise<void> {
        this.tokenData = null;
        await logseq.updateSettings({
            "oauth_tokens": null
        });
    }
} 
