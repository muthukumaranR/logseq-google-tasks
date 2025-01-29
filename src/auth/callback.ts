/**
 * OAuth2 callback handler
 * This file handles the OAuth2 callback from Google
 */

/**
 * Handles the OAuth2 callback by sending the authorization code to the parent window
 */
export function handleCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
        window.opener.postMessage(
            {
                type: "oauth_callback",
                code
            },
            window.location.origin
        );
    } else {
        const error = urlParams.get("error");
        console.error("OAuth callback error:", error);
    }
} 